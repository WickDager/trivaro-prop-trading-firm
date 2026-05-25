import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

export const supabase = createClient(supabaseUrl, supabaseKey);

export async function getOrderByPaymentId(paymentId: string) {
  const { data } = await supabase
    .from('orders')
    .select('*')
    .eq('payment_id', paymentId)
    .single();
  return data;
}

export async function updateOrder(paymentId: string, updates: Record<string, unknown>) {
  const { data } = await supabase
    .from('orders')
    .update(updates)
    .eq('payment_id', paymentId)
    .select()
    .single();
  return data;
}
