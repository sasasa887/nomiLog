// ============================================================
//  のみログ ── 課金モジュール (billing.js)
//  ・課金状態（プレミアムか）の取得
//  ・決済画面（Stripe Checkout）を開く
//  読み込み順：supabase.js → sync.js → billing.js → app.js
// ============================================================

const Billing = (() => {
  let _isPremium = false;
  let _status = 'free';
  let _periodEnd = null;

  // ── 課金状態をSupabaseから取得 ──
  async function refresh() {
    try {
      const user = await getCurrentUser();
      if (!user) { _isPremium = false; _status = 'free'; return _isPremium; }

      const { data, error } = await sbClient
        .from('subscriptions')
        .select('status, current_period_end, cancel_at_period_end')
        .eq('user_id', user.id)
        .single();

      if (error || !data) { _isPremium = false; _status = 'free'; return _isPremium; }

      _status = data.status;
      _periodEnd = data.current_period_end;

      // active か trialing で、期間内ならプレミアム
      const validStatus = (data.status === 'active' || data.status === 'trialing');
      const notExpired = !data.current_period_end ||
                         new Date(data.current_period_end) > new Date();
      _isPremium = validStatus && notExpired;
      return _isPremium;
    } catch (e) {
      console.warn('課金状態の取得に失敗', e);
      _isPremium = false;
      return false;
    }
  }

  function isPremium() { return _isPremium; }
  function getStatus() { return _status; }
  function getPeriodEnd() { return _periodEnd; }

  // ── 決済画面を開く（Edge Function経由でCheckout URLを取得）──
  async function startCheckout() {
    const user = await getCurrentUser();
    if (!user) { throw new Error('ログインが必要です'); }

    // 現在のセッションのJWTを取得
    const { data: { session } } = await sbClient.auth.getSession();
    if (!session) throw new Error('セッションが見つかりません');

    // create-checkout Edge Function を呼ぶ
    const res = await fetch(
      `${sbClient.supabaseUrl}/functions/v1/create-checkout`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      },
    );
    const json = await res.json();
    if (json.error) throw new Error(json.error);
    if (json.url) {
      window.location.href = json.url; // Stripeの決済ページへ
    }
  }

  // ── 解約・支払い管理（Stripeカスタマーポータル）──
  // ※ 別途 create-portal Edge Function が必要（フェーズ2で追加）
  async function openPortal() {
    const { data: { session } } = await sbClient.auth.getSession();
    if (!session) throw new Error('セッションが見つかりません');
    const res = await fetch(
      `${sbClient.supabaseUrl}/functions/v1/create-portal`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      },
    );
    const json = await res.json();
    if (json.url) window.location.href = json.url;
  }

  return { refresh, isPremium, getStatus, getPeriodEnd, startCheckout, openPortal };
})();

window.Billing = Billing;
