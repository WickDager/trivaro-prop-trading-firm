import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

// Fail fast: a client built from undefined values only errors on the first
// query, which the handlers would report to the user as "order not found".
if (!supabaseUrl || !supabaseKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

export async function getOrderByPaymentId(paymentId: string) {
  // maybeSingle(): a real 0-row result is `data: null, error: null`, while a
  // transient query failure comes back as an error and is no longer reported
  // to the user as a missing order.
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('payment_id', paymentId)
    .maybeSingle();
  if (error) {
    console.error('getOrderByPaymentId failed:', error.message);
    return null;
  }
  return data;
}

export async function updateOrder(paymentId: string, updates: Record<string, unknown>) {
  const { data, error } = await supabase
    .from('orders')
    .update(updates)
    .eq('payment_id', paymentId)
    .select()
    .maybeSingle();
  if (error) {
    console.error('updateOrder failed:', error.message);
    return null;
  }
  return data;
}
