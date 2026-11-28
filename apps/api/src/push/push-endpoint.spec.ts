import { isAcceptablePushEndpoint } from './push-endpoint.js';
import { pushUrl } from './push-url.js';

describe('isAcceptablePushEndpoint', () => {
  it('accepts an https URL on a public host name', () => {
    expect(isAcceptablePushEndpoint('https://push.example.com/send/abc')).toBe(
      true,
    );
    expect(
      isAcceptablePushEndpoint('https://push.example.com:443/send/abc'),
    ).toBe(true);
  });

  it.each([
    'http://push.example.com/x',
    'https://localhost/x',
    'https://intranet/x',
    'https://127.0.0.1/x',
    'https://10.0.0.5/x',
    'https://[::1]/x',
    'https://printer.local/x',
    'https://db.internal/x',
    'https://push.example.com:8443/x',
    'https://user:pass@push.example.com/x',
    'not a url',
    '',
  ])('rejects %s', (value) => {
    expect(isAcceptablePushEndpoint(value)).toBe(false);
  });
});

describe('pushUrl', () => {
  it('opens the order for the role that owns it', () => {
    expect(pushUrl('MANAGER', 'ORDER_PLACED', 'o1')).toBe('/manager/orders/o1');
    expect(pushUrl('AGENT', 'ORDER_ASSIGNED', 'o1')).toBe('/agent/orders/o1');
  });

  it('opens the list when there is nothing the user may open', () => {
    expect(pushUrl('AGENT', 'ORDER_RELEASED', 'o1')).toBe('/notifications');
    expect(pushUrl('MANAGER', 'ORDER_PLACED', null)).toBe('/notifications');
  });
});
