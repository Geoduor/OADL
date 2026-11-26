// Every customer-facing sentence lives here so the client can approve or
// change the wording in one place (open question Q14). Placeholders only:
// no benefits and no health claims. English only (D39).
// TODO(confirm): the client must approve all of this wording (Q14).

export const copy = {
  siteTitle: 'Order online, pay on delivery',
  siteDescription:
    'Choose your bundle, place your order and pay when it is delivered.',
  homeHeading: 'Products',
  homeEmpty: 'No products are available right now. Please check again soon.',
  from: 'From',
  chooseBundle: 'Choose your bundle',
  unit: 'unit',
  units: 'units',
  yourDetails: 'Your details',
  name: 'Full name',
  phone: 'Phone number',
  phoneHint: 'We will call this number about your order.',
  county: 'County',
  chooseCounty: 'Choose your county',
  location: 'Delivery location',
  locationHint: 'Town, estate or nearest landmark',
  total: 'Total',
  payOnDelivery: 'Pay on delivery. You pay when your order is delivered.',
  submit: 'Place order',
  submitting: 'Placing your order…',
  talkToUs: 'Talk to us on WhatsApp',
  thanksHeading: 'Thank you, we have received your order',
  orderNumber: 'Your order number',
  whatNext: 'We will contact you to confirm your order and arrange delivery.',
  keepNumber: 'Please keep your order number.',
  backToShop: 'Back to products',
  notFound: 'We could not find that page.',
  somethingWrong: 'Something went wrong. Please try again.',
  tooManyAttempts: 'Too many attempts. Please wait a minute and try again.',
  tryAgainSoon:
    'We could not place your order just now. Please try again in a moment.',
  noConnection:
    'Could not reach the server. Check your connection and try again.',
  botCheckMissing: 'Ordering is not available right now.',
} as const;
