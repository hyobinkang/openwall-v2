import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const origin = request.nextUrl.origin

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
  }

  // redirect response를 먼저 만들고, 쿠키를 이 response에 직접 설정한다.
  // cookies() (next/headers) 방식은 별도 NextResponse 반환 시 쿠키가 전달되지 않는다.
  const response = NextResponse.redirect(`${origin}/dashboard`)

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          // PKCE verifier는 브라우저가 보낸 request cookies에 있다
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // 세션 쿠키를 redirect response에 직접 실어야 브라우저가 받을 수 있다
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
  }

  return response
}
