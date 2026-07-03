-- ============================================================
-- CEIBA — Paso 5: TRIGGERS DE INTEGRIDAD
-- ============================================================

-- 1) updated_at automático
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

drop trigger if exists persons_updated_at on public.persons;
create trigger persons_updated_at before update on public.persons
for each row execute function public.set_updated_at();

drop trigger if exists relationships_updated_at on public.relationships;
create trigger relationships_updated_at before update on public.relationships
for each row execute function public.set_updated_at();


-- 2) Anti-ciclos padre/hijo
create or replace function public.check_no_parent_cycle()
returns trigger language plpgsql as $$
begin
  if new.relationship_type = 'parent_of' then
    if exists (
      select 1 from public.relationships
      where relationship_type = 'parent_of'
        and person_a_id = new.person_b_id
        and person_b_id = new.person_a_id
    ) then
      raise exception 'ciclo padre/hijo detectado entre % y %',
        new.person_a_id, new.person_b_id;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_no_cycle on public.relationships;
create trigger trg_no_cycle before insert on public.relationships
for each row execute function public.check_no_parent_cycle();


-- 3) Coherencia biológica: padre no puede haber nacido después que el hijo
create or replace function public.check_parent_birthdate()
returns trigger language plpgsql as $$
declare a_birth date; b_birth date;
begin
  if new.relationship_type = 'parent_of' then
    select birth_date into a_birth from public.persons where id = new.person_a_id;
    select birth_date into b_birth from public.persons where id = new.person_b_id;
    if a_birth is not null and b_birth is not null and a_birth >= b_birth then
      raise exception 'padre (%) no puede haber nacido después que el hijo (%)', a_birth, b_birth;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_parent_birth on public.relationships;
create trigger trg_parent_birth before insert on public.relationships
for each row execute function public.check_parent_birthdate();


-- 4) Normalización de simétricas (person_a_id < person_b_id)
create or replace function public.normalize_symmetric_relationship()
returns trigger language plpgsql as $$
declare tmp uuid;
begin
  if new.relationship_type in ('partner_of','sibling_of','half_sibling_of')
     and new.person_a_id > new.person_b_id then
    tmp := new.person_a_id;
    new.person_a_id := new.person_b_id;
    new.person_b_id := tmp;
  end if;
  return new;
end $$;

drop trigger if exists trg_normalize_sym on public.relationships;
create trigger trg_normalize_sym before insert on public.relationships
for each row execute function public.normalize_symmetric_relationship();


-- 5) Calcular pair_key (debe correr después de trg_normalize_sym — "s" > "n")
create or replace function public.set_pair_key()
returns trigger language plpgsql as $$
begin
  new.pair_key :=
    case when new.person_a_id::text < new.person_b_id::text
      then new.person_a_id::text || '__' || new.person_b_id::text
      else new.person_b_id::text || '__' || new.person_a_id::text
    end || '::' || new.relationship_type::text;
  return new;
end $$;

drop trigger if exists trg_set_pair_key on public.relationships;
create trigger trg_set_pair_key before insert or update on public.relationships
for each row execute function public.set_pair_key();


-- 7) Registrar creación/modificación en audit_logs
create or replace function public.audit_relationship_change()
returns trigger language plpgsql as $$
begin
  insert into public.audit_logs (actor_user_id, action, target_type, target_id, diff)
  values (
    coalesce(new.declared_by_user_id, auth.uid()),
    tg_op,                              -- INSERT / UPDATE / DELETE
    'relationship',
    coalesce(new.id, old.id),
    jsonb_build_object('after', to_jsonb(new), 'before', to_jsonb(old))
  );
  return coalesce(new, old);
end $$;

drop trigger if exists trg_audit_rel on public.relationships;
create trigger trg_audit_rel after insert or update or delete on public.relationships
for each row execute function public.audit_relationship_change();


-- 8) Registrar cambio de is_living o death_date en persons
create or replace function public.audit_person_status()
returns trigger language plpgsql as $$
begin
  if (old.is_living is distinct from new.is_living)
     or (old.death_date is distinct from new.death_date) then
    insert into public.audit_logs (actor_user_id, action, target_type, target_id, diff)
    values (
      auth.uid(),
      'person.status_change',
      'person',
      new.id,
      jsonb_build_object(
        'before', jsonb_build_object('is_living', old.is_living, 'death_date', old.death_date),
        'after',  jsonb_build_object('is_living', new.is_living, 'death_date', new.death_date)
      )
    );
  end if;
  return new;
end $$;

drop trigger if exists trg_audit_person on public.persons;
create trigger trg_audit_person after update on public.persons
for each row execute function public.audit_person_status();


-- Verificar
select trigger_name, event_manipulation, event_object_table
from information_schema.triggers
where trigger_schema = 'public'
order by event_object_table, trigger_name;
