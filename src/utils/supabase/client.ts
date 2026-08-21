// src/utils/supabase/client.ts
export function createClient() {
  throw new Error(
    'Supabase client is no longer used—please migrate this code to Firebase.'
  )
}

// Add this named export so imports of `supabase` resolve:
export const supabase = {
  // anything you call on supabase.* will now throw at runtime:
  from() { throw new Error('Supabase.from used in migrated code—migrate to Firebase.'); },
  // you can stub any other methods you happened to use
}
