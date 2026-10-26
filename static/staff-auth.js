const CS_STAFF_KEY = 'cs-staff-login';
const CS_PINS_KEY = 'cs-staff-pins';
const CS_DEFAULT_PIN = '9292';
const CS_ADMIN_NAME = 'H.M. C.Harshani Thilakarathna';
const CS_STAFF_ROLES = {
  'B.M.N. S.Basnayaka': 'Sales Executive',
  'G.H.I. R.Nayanajith': 'Sales Executive',
  'Malki Rasanga Widanagamge': 'Executive Admin and Marketing',
  'H.M. C.Harshani Thilakarathna': 'Admin',
  'D.A.R. N.Dissanayaka': 'Managing Director'
};
const CS_STAFF_ALIAS = {
  Nipun: 'B.M.N. S.Basnayaka',
  Isuru: 'G.H.I. R.Nayanajith',
  Malki: 'Malki Rasanga Widanagamge',
  Harshani: 'H.M. C.Harshani Thilakarathna',
  'H.M.C.Harshani Thilakarathna': 'H.M. C.Harshani Thilakarathna',
  Rakitha: 'D.A.R. N.Dissanayaka'
};

function csCanonical(name) {
  const clean = String(name || '').trim();
  if (!clean) return '';
  if (CS_STAFF_ROLES[clean]) return clean;
  if (CS_STAFF_ALIAS[clean]) return CS_STAFF_ALIAS[clean];
  const lower = clean.toLowerCase();
  const hit = Object.keys(CS_STAFF_ROLES).find((key) => key.toLowerCase() === lower);
  if (hit) return hit;
  const alias = Object.keys(CS_STAFF_ALIAS).find((key) => key.toLowerCase() === lower);
  return alias ? CS_STAFF_ALIAS[alias] : '';
}

function csSamePerson(a, b) {
  const left = csCanonical(a);
  const right = csCanonical(b);
  return !!left && left === right;
}

function csStaffName() {
  const name = csCanonical(localStorage.getItem(CS_STAFF_KEY) || '');
  if (name) localStorage.setItem(CS_STAFF_KEY, name);
  return name;
}

function csIsAdmin() {
  return CS_STAFF_ROLES[csStaffName()] === 'Admin';
}

function csStaffRole() {
  return CS_STAFF_ROLES[csStaffName()] || '';
}

function csSetStaff(name) {
  const clean = csCanonical(name);
  if (!clean) {
    localStorage.removeItem(CS_STAFF_KEY);
    return false;
  }
  localStorage.setItem(CS_STAFF_KEY, clean);
  return true;
}

function csClearStaff() {
  localStorage.removeItem(CS_STAFF_KEY);
}

function csLoginPath(nextPath) {
  const next = nextPath || (location.pathname + location.search);
  return 'quote-login.html?next=' + encodeURIComponent(next);
}

function csRequireStaff() {
  const path = location.pathname || '';
  if (/quote-login/i.test(path)) return csStaffName();
  if (!csStaffName()) {
    location.replace(csLoginPath());
    return '';
  }
  return csStaffName();
}

function csLoadPins() {
  try {
    const raw = JSON.parse(localStorage.getItem(CS_PINS_KEY) || '{}');
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  } catch (_) {
    return {};
  }
}

function csPinFor(name) {
  const clean = csCanonical(name);
  if (!clean) return CS_DEFAULT_PIN;
  const pins = csLoadPins();
  const custom = pins[clean] || pins[String(name || '').trim()];
  return typeof custom === 'string' && custom ? custom : CS_DEFAULT_PIN;
}

function csCheckPin(name, pin) {
  const clean = csCanonical(name);
  const entered = String(pin || '').trim();
  return !!clean && entered === csPinFor(clean);
}

function csValidPinFormat(pin) {
  return /^\d{4,8}$/.test(String(pin || '').trim());
}

function csSetPin(name, newPin) {
  const clean = csCanonical(name);
  const pin = String(newPin || '').trim();
  if (!clean || !csValidPinFormat(pin)) return false;
  const pins = csLoadPins();
  pins[clean] = pin;
  localStorage.setItem(CS_PINS_KEY, JSON.stringify(pins));
  return true;
}

function csChangePin(targetName, currentPin, newPin) {
  const target = csCanonical(targetName);
  const me = csStaffName();
  if (!target) return { ok: false, error: 'Select a staff name' };
  if (!me) return { ok: false, error: 'Login first' };
  if (target !== me && !csIsAdmin()) {
    return { ok: false, error: 'Only Admin can change another user PIN' };
  }
  if (!csCheckPin(me, currentPin)) {
    return { ok: false, error: 'Current PIN is wrong' };
  }
  if (!csValidPinFormat(newPin)) {
    return { ok: false, error: 'New PIN must be 4–8 digits' };
  }
  if (!csSetPin(target, newPin)) {
    return { ok: false, error: 'Could not save PIN' };
  }
  return { ok: true };
}

async function csSession() {
  try {
    const res = await fetch('/api/session', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data && data.staff) {
        csSetStaff(data.staff);
        return {
          staff: data.staff,
          role: data.role || csStaffRole(),
          isAdmin: !!data.isAdmin || csIsAdmin()
        };
      }
    }
  } catch (_) {}
  const staff = csStaffName();
  return {
    staff,
    role: csStaffRole(),
    isAdmin: csIsAdmin()
  };
}

window.CS_STAFF_KEY = CS_STAFF_KEY;
window.CS_PINS_KEY = CS_PINS_KEY;
window.CS_DEFAULT_PIN = CS_DEFAULT_PIN;
window.CS_STAFF_PIN = CS_DEFAULT_PIN;
window.CS_ADMIN_NAME = CS_ADMIN_NAME;
window.CS_STAFF_ROLES = CS_STAFF_ROLES;
window.csCanonical = csCanonical;
window.csSamePerson = csSamePerson;
window.csStaffName = csStaffName;
window.csIsAdmin = csIsAdmin;
window.csStaffRole = csStaffRole;
window.csSetStaff = csSetStaff;
window.csClearStaff = csClearStaff;
window.csRequireStaff = csRequireStaff;
window.csSession = csSession;
window.csLoginPath = csLoginPath;
window.csLoadPins = csLoadPins;
window.csPinFor = csPinFor;
window.csCheckPin = csCheckPin;
window.csValidPinFormat = csValidPinFormat;
window.csSetPin = csSetPin;
window.csChangePin = csChangePin;

function csBackFallback() {
  const path = location.pathname || '';
  const query = new URLSearchParams(location.search);
  const company = query.get('company') || '';
  if (/quote-pick|agree-pick|preorder-pick|invoice-pick/i.test(path)) return '/desk';
  if (/invoice-menu/i.test(path)) return '/invoice-pick';
  if (/quotations/i.test(path)) return '/quote-pick';
  if (/\/quotation/i.test(path)) return '/quotations';
  if (/\/preorder/i.test(path)) return '/preorder-pick';
  if (/\/agreement$/i.test(path) || /agreement\.html/i.test(path)) return '/agree-pick';
  if (/agreements/i.test(path)) {
    const kind = (query.get('kind') || '').toLowerCase();
    if (kind === 'invoice') {
      return company ? '/invoice-menu?company=' + encodeURIComponent(company) : '/invoice-pick';
    }
    if (kind === 'sales') return '/agree-pick';
    if (kind === 'preorder') return '/preorder-pick';
    return '/desk';
  }
  if (/invoice/i.test(path)) {
    return company ? '/invoice-menu?company=' + encodeURIComponent(company) : '/invoice-pick';
  }
  return '/desk';
}

function csGoBack(btn) {
  const given = btn && btn.getAttribute('data-back');
  const fallback = given || csBackFallback();
  let sameOrigin = false;
  try {
    sameOrigin = !!document.referrer && new URL(document.referrer).origin === location.origin;
  } catch (_) {}
  if (sameOrigin && window.history.length > 1) {
    history.back();
    return;
  }
  location.href = fallback;
}

document.addEventListener('click', (event) => {
  const btn = event.target.closest('[data-back]');
  if (!btn) return;
  event.preventDefault();
  csGoBack(btn);
});
