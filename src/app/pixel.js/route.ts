import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-static';

// Drop-in pixel for brand thank-you pages:
//   <script async src="https://partner.711web.com/pixel.js"
//           data-brand-key="pk_..." data-amount="49.00"
//           data-currency="USD" data-order-id="ord_123"></script>
// Reads `_clid` cookie from partner.711web.com via a cross-origin <img> beacon
// to the /api/conversion endpoint. Falls back to the body's data-click-id.
const PIXEL_JS = `(function(){
  try {
    var s = document.currentScript;
    if (!s) return;
    var brandKey = s.getAttribute('data-brand-key');
    if (!brandKey) { console.warn('[partner-pixel] missing data-brand-key'); return; }
    var amount = s.getAttribute('data-amount');
    var amountCents = s.getAttribute('data-amount-cents');
    var currency = s.getAttribute('data-currency') || 'USD';
    var orderId = s.getAttribute('data-order-id');
    var clickId = s.getAttribute('data-click-id') || null;
    var endpoint = (s.src.replace(/\\/pixel\\.js.*$/, '') + '/api/conversion');
    var payload = {
      click_id: clickId,
      currency: currency,
      order_id: orderId
    };
    if (amountCents != null) payload.amount_cents = +amountCents;
    else if (amount != null)  payload.amount = +amount;
    fetch(endpoint, {
      method: 'POST',
      mode: 'cors',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-Brand-Key': brandKey },
      body: JSON.stringify(payload),
      keepalive: true
    }).catch(function(){});
  } catch(e) { /* noop */ }
})();`;

export function GET() {
  return new NextResponse(PIXEL_JS, {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=300',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
