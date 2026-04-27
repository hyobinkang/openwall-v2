import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

// 쿠키/세션 없이 service_role JWT로 동작 — RLS 완전 우회
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
