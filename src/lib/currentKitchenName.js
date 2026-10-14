import { createClient } from '../utils/supabase/server';
import { kitchenName } from './kitchenName';

// Server-only: the signed-in user's kitchen name (falls back to "My Kitchen").
export async function currentKitchenName() {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return kitchenName(null);
    const { data: goal } = await supabase.from('goals').select('display_name').eq('user_id', user.id).maybeSingle();
    return kitchenName(goal?.display_name || user.user_metadata?.display_name || user.user_metadata?.full_name);
  } catch {
    return kitchenName(null);
  }
}
