import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  type CookieToSet = {
    name: string;
    value: string;
    options?: Parameters<typeof supabaseResponse.cookies.set>[2];
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // /invite (sin token) requiere sesión — es el flujo de invitar a otros.
  // /invite/[token] debe quedar público: es el enlace que recibe un familiar
  // sin cuenta todavía; get_invitation_by_token() ya está diseñada para
  // funcionar sin sesión y la propia página resuelve el registro/login.
  const protectedPaths = ['/home', '/tree', '/map', '/profile', '/onboarding']
  const devPreviews = ['/home/preview', '/dev/']
  const isProtected =
    !devPreviews.some(p => request.nextUrl.pathname.startsWith(p)) &&
    (protectedPaths.some(p => request.nextUrl.pathname.startsWith(p)) ||
    request.nextUrl.pathname === '/invite')

  if (!user && isProtected) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
