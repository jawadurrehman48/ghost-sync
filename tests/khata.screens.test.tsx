import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react';
import { i18n, registerAppTranslations, todayISO } from '@skeleton/core';
import type { Language, Store } from '@skeleton/core';
import { deriveAll } from '../apps/khata/src/khata.reducers';
import type { KhataCollections, KhataData } from '../apps/khata/src/khata.types';
import type { ScreenProps } from '../apps/khata/src/screens/types';
import { AddCustomerScreen } from '../apps/khata/src/screens/AddCustomerScreen';
import { AddEntryScreen } from '../apps/khata/src/screens/AddEntryScreen';
import { CustomerDetailScreen } from '../apps/khata/src/screens/CustomerDetailScreen';
import { CustomerListScreen } from '../apps/khata/src/screens/CustomerListScreen';
import { DashboardScreen } from '../apps/khata/src/screens/DashboardScreen';
import { QuickEntryScreen } from '../apps/khata/src/screens/QuickEntryScreen';
import { ReportsScreen } from '../apps/khata/src/screens/ReportsScreen';
import { ReverseEntryScreen } from '../apps/khata/src/screens/ReverseEntryScreen';
import { SettingsScreen } from '../apps/khata/src/screens/SettingsScreen';
import en from '../apps/khata/src/i18n/en.json';
import ur from '../apps/khata/src/i18n/ur.json';
import { rec } from './khata.helpers';

const TODAY = todayISO();
const OLD = '2000-01-01';

/**
 * Ahmed (has phone): credit Rs 5,000 today, payment Rs 1,000, credit Rs 2,000 today REVERSED → owes Rs 4,000
 * Tariq (no phone):  credit Rs 1,500                                                     → owes Rs 1,500
 * Sara:              credit Rs 1,000 + payment Rs 1,000                                  → settled
 * Fatima:            payment Rs 500 today                                                → advance Rs 500
 */
const DATA: KhataData = {
  customerCreated: [
    rec('customerCreated', { name: 'Ahmed Ali', phone: '03001234567', note: 'Regular' }, 'ahmed', 1),
    rec('customerCreated', { name: 'Tariq Mehmood' }, 'tariq', 2),
    rec('customerCreated', { name: 'Sara Begum' }, 'sara', 3),
    rec('customerCreated', { name: 'Fatima Noor', phone: '03331234567' }, 'fatima', 4),
  ],
  customerUpdated: [],
  creditGiven: [
    rec('creditGiven', { customerId: 'ahmed', amountPaisa: 500000, date: TODAY, note: 'Ration' }, 'a1', 10),
    rec('creditGiven', { customerId: 'ahmed', amountPaisa: 200000, date: TODAY, note: 'typo' }, 'a3', 12),
    rec('creditGiven', { customerId: 'tariq', amountPaisa: 150000, date: OLD }, 't1', 13),
    rec('creditGiven', { customerId: 'sara', amountPaisa: 100000, date: OLD }, 's1', 14),
  ],
  paymentReceived: [
    rec('paymentReceived', { customerId: 'ahmed', amountPaisa: 100000, date: OLD }, 'a2', 11),
    rec('paymentReceived', { customerId: 'sara', amountPaisa: 100000, date: OLD }, 's2', 15),
    rec('paymentReceived', { customerId: 'fatima', amountPaisa: 50000, date: TODAY }, 'f1', 16),
  ],
  entryReversed: [rec('entryReversed', { entryId: 'a3', reason: 'Typed wrong amount' }, 'r1', 17)],
  settingsUpdated: [],
};

function mockStore() {
  let n = 0;
  const add = vi.fn(async (collection: string, payload: unknown) => ({
    id: `new-${++n}`,
    createdAt: new Date().toISOString(),
    deviceId: 'test',
    collection,
    payload,
  }));
  // Nothing is stored yet, so loadDemoData sees "demo data not loaded".
  const query = vi.fn(async () => []);
  return { add, query, store: { add, query } as unknown as Store<KhataCollections> };
}

function makeProps(language: Language = 'en') {
  const { store, add } = mockStore();
  const navigate = vi.fn();
  const onChanged = vi.fn(async () => {});
  const changeLanguage = vi.fn(async () => {});
  const onClearAll = vi.fn(async () => {});
  const props: ScreenProps = {
    data: DATA,
    derived: deriveAll(DATA, TODAY),
    store,
    navigate,
    onChanged,
    language,
    changeLanguage,
    onClearAll,
    devices: {
      mode: 'memory',
      workspaceCode: '0b5c1a7e-2f3d-4c8b-9a6e-1d2f3a4b5c6d',
      joinUrl: 'https://khata.example/#join=0b5c1a7e-2f3d-4c8b-9a6e-1d2f3a4b5c6d',
      join: vi.fn(async () => 'joined' as const),
    },
  };
  return { props, add, navigate, onChanged, changeLanguage, onClearAll };
}

const KEY_LEAK = /khata\.[a-z]+\.[a-zA-Z]+/;

beforeAll(() => {
  registerAppTranslations({ en, ur });
});

afterEach(async () => {
  cleanup(); // unmount first, so the language reset below doesn't re-render a mounted screen
  await i18n.changeLanguage('en');
});

describe.each(['en', 'ur'] as const)('every screen renders in %s', (language) => {
  const screens: Array<[string, (p: ScreenProps) => React.ReactElement]> = [
    ['Dashboard', (p) => <DashboardScreen {...p} />],
    ['CustomerList', (p) => <CustomerListScreen {...p} />],
    ['AddCustomer', (p) => <AddCustomerScreen {...p} />],
    ['EditCustomer', (p) => <AddCustomerScreen {...p} customerId="ahmed" />],
    ['CustomerDetail', (p) => <CustomerDetailScreen {...p} customerId="ahmed" />],
    ['CustomerDetail (no phone, owes)', (p) => <CustomerDetailScreen {...p} customerId="tariq" />],
    ['CustomerDetail (unknown)', (p) => <CustomerDetailScreen {...p} customerId="ghost" />],
    ['AddEntry credit', (p) => <AddEntryScreen {...p} customerId="ahmed" type="credit" />],
    ['AddEntry payment', (p) => <AddEntryScreen {...p} customerId="ahmed" type="payment" />],
    ['QuickEntry', (p) => <QuickEntryScreen {...p} from="dashboard" />],
    ['ReverseEntry', (p) => <ReverseEntryScreen {...p} customerId="ahmed" entryId="a1" />],
    ['ReverseEntry (already reversed)', (p) => <ReverseEntryScreen {...p} customerId="ahmed" entryId="a3" />],
    ['ReverseEntry (unknown)', (p) => <ReverseEntryScreen {...p} customerId="ahmed" entryId="nope" />],
    ['Reports', (p) => <ReportsScreen {...p} />],
    ['Settings', (p) => <SettingsScreen {...p} />],
  ];

  it.each(screens)('%s shows no raw translation keys and uses the right direction', async (_name, build) => {
    await i18n.changeLanguage(language);
    const { props } = makeProps(language);
    const { container } = render(build(props));

    expect(container.textContent ?? '').not.toMatch(KEY_LEAK);
    expect(container.textContent?.trim().length).toBeGreaterThan(0);
    expect(document.documentElement.dir).toBe(language === 'ur' ? 'rtl' : 'ltr');
    expect(document.documentElement.lang).toBe(language);
  });
});

describe('Urdu text appears on screen', () => {
  it('dashboard and customer detail use Urdu words', async () => {
    await i18n.changeLanguage('ur');
    const { props } = makeProps('ur');
    const dashboard = render(<DashboardScreen {...props} />);
    expect(screen.getByText('کل بقایا')).toBeTruthy();
    expect(screen.getByText('آج')).toBeTruthy();
    dashboard.unmount();

    render(<CustomerDetailScreen {...props} customerId="ahmed" />);
    expect(screen.getByRole('button', { name: 'ادھار دیں' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'ادائیگی لیں' })).toBeTruthy();
    expect(screen.getByText('یاد دہانی بھیجیں')).toBeTruthy();
  });

  it('amounts stay in Rs with separators and are forced left-to-right inside Urdu text', async () => {
    await i18n.changeLanguage('ur');
    const { props } = makeProps('ur');
    render(<DashboardScreen {...props} />);
    const total = screen.getByText('Rs 5,500');
    expect(total.getAttribute('dir')).toBe('ltr');
  });
});

describe('Dashboard', () => {
  it('shows total outstanding, todays credit and payments, and the top debtors (reversed entries excluded)', () => {
    const { props } = makeProps();
    render(<DashboardScreen {...props} />);
    expect(screen.getByText('Rs 5,500')).toBeTruthy(); // 4,000 + 1,500
    expect(screen.getByText('Rs 5,000')).toBeTruthy(); // credit today: Rs 5,000 (Rs 2,000 reversed is excluded)
    expect(screen.getByText('Rs 500')).toBeTruthy(); // payments today
    expect(screen.getByText('Ahmed Ali')).toBeTruthy();
    expect(screen.getByText('Tariq Mehmood')).toBeTruthy();
    expect(screen.queryByText('Sara Begum')).toBeNull(); // settled, not a debtor
  });

  it('colours owed amounts red and received amounts green', () => {
    const { props } = makeProps();
    render(<DashboardScreen {...props} />);
    expect(screen.getByText('Rs 5,500').className).toContain('text-red-600');
    expect(screen.getByText('Rs 500').className).toContain('text-green-700');
  });

  it('opens a debtor when tapped', () => {
    const { props, navigate } = makeProps();
    render(<DashboardScreen {...props} />);
    fireEvent.click(screen.getByText('Ahmed Ali'));
    expect(navigate).toHaveBeenCalledWith({ name: 'customerDetail', customerId: 'ahmed' });
  });

  it('says so when nobody owes anything', () => {
    const { props } = makeProps();
    const empty: KhataData = { ...DATA, creditGiven: [], paymentReceived: [], entryReversed: [] };
    render(<DashboardScreen {...props} data={empty} derived={deriveAll(empty, TODAY)} />);
    expect(screen.getByText('No one owes money right now')).toBeTruthy();
  });
});

describe('Customer list', () => {
  it('lists customers with the highest balance first and a status word beside each amount', () => {
    const { props } = makeProps();
    const { container } = render(<CustomerListScreen {...props} />);
    const text = container.textContent ?? '';
    const order = ['Ahmed Ali', 'Tariq Mehmood', 'Sara Begum', 'Fatima Noor'].map((n) => text.indexOf(n));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect(screen.getByText('Rs 4,000').className).toContain('text-red-600');
    expect(screen.getByText('Rs 0').className).toContain('text-green-700');
    expect(screen.getByText('-Rs 500').className).toContain('text-green-700');
    expect(screen.getAllByText('Owes')).toHaveLength(2);
    expect(screen.getByText('Settled')).toBeTruthy();
    expect(screen.getByText('Advance')).toBeTruthy();
  });

  it('filters by name and by phone as you type', () => {
    const { props } = makeProps();
    render(<CustomerListScreen {...props} />);
    const search = screen.getByLabelText('Search name or phone');

    fireEvent.change(search, { target: { value: 'sara' } });
    expect(screen.getByText('Sara Begum')).toBeTruthy();
    expect(screen.queryByText('Ahmed Ali')).toBeNull();

    fireEvent.change(search, { target: { value: '0333' } });
    expect(screen.getByText('Fatima Noor')).toBeTruthy();
    expect(screen.queryByText('Sara Begum')).toBeNull();

    fireEvent.change(search, { target: { value: 'nobody' } });
    expect(screen.getByText('No customer found')).toBeTruthy();
  });

  it('opens a customer and the add-customer form', () => {
    const { props, navigate } = makeProps();
    render(<CustomerListScreen {...props} />);
    fireEvent.click(screen.getByText('Tariq Mehmood'));
    expect(navigate).toHaveBeenCalledWith({ name: 'customerDetail', customerId: 'tariq' });
    fireEvent.click(screen.getByRole('button', { name: 'Add Customer' }));
    expect(navigate).toHaveBeenCalledWith({ name: 'addCustomer' });
  });

  it('shows a friendly message when there are no customers', () => {
    const { props } = makeProps();
    const empty: KhataData = { ...DATA, customerCreated: [] };
    render(<CustomerListScreen {...props} derived={deriveAll(empty, TODAY)} />);
    expect(screen.getByText(/No customers yet/)).toBeTruthy();
  });
});

describe('Add customer', () => {
  it('requires a name', () => {
    const { props, add } = makeProps();
    render(<AddCustomerScreen {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Save Customer' }));
    expect(screen.getByRole('alert').textContent).toBe('Name is required');
    expect(add).not.toHaveBeenCalled();
  });

  it('rejects an invalid phone but allows a blank one', async () => {
    const { props, add, navigate } = makeProps();
    render(<AddCustomerScreen {...props} />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ali Raza' } });
    fireEvent.change(screen.getByLabelText('Phone (optional)'), { target: { value: '12345' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Customer' }));
    expect(screen.getByRole('alert').textContent).toContain('valid Pakistani mobile number');
    expect(add).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Phone (optional)'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Customer' }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ name: 'customerList' }));
    expect(add).toHaveBeenCalledWith('customerCreated', { name: 'Ali Raza' });
  });

  it('saves a trimmed name, a normalised phone and the note, then returns to the list', async () => {
    const { props, add, navigate, onChanged } = makeProps();
    render(<AddCustomerScreen {...props} />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '  Ali Raza  ' } });
    fireEvent.change(screen.getByLabelText('Phone (optional)'), { target: { value: '0300-1234567' } });
    fireEvent.change(screen.getByLabelText('Note (optional)'), { target: { value: 'Neighbour' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Customer' }));

    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ name: 'customerList' }));
    expect(add).toHaveBeenCalledWith('customerCreated', {
      name: 'Ali Raza',
      phone: '03001234567',
      note: 'Neighbour',
    });
    expect(onChanged).toHaveBeenCalled();
  });

  it('shows an error and stays on the form if saving fails', async () => {
    const { props, add, navigate } = makeProps();
    add.mockRejectedValueOnce(new Error('disk full'));
    render(<AddCustomerScreen {...props} />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ali' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Customer' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Something went wrong'));
    expect(navigate).not.toHaveBeenCalled();
  });

  it('edit mode saves only the changed fields as an append-only customerUpdated record', async () => {
    const { props, add, navigate } = makeProps();
    render(<AddCustomerScreen {...props} customerId="ahmed" />);
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Ahmed Ali');

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ahmed Ali Khan' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Customer' }));

    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ name: 'customerDetail', customerId: 'ahmed' }));
    expect(add).toHaveBeenCalledTimes(1);
    expect(add).toHaveBeenCalledWith('customerUpdated', { customerId: 'ahmed', name: 'Ahmed Ali Khan' });
  });

  it('edit mode with no changes writes nothing', async () => {
    const { props, add, navigate } = makeProps();
    render(<AddCustomerScreen {...props} customerId="ahmed" />);
    fireEvent.click(screen.getByRole('button', { name: 'Save Customer' }));
    await waitFor(() => expect(navigate).toHaveBeenCalled());
    expect(add).not.toHaveBeenCalled();
  });
});

describe('Customer detail', () => {
  it('shows the balance, customer info and both action buttons', () => {
    const { props, navigate } = makeProps();
    render(<CustomerDetailScreen {...props} customerId="ahmed" />);
    expect(screen.getByText('Ahmed Ali')).toBeTruthy();
    expect(screen.getByText('0300-1234567')).toBeTruthy(); // shown formatted, stored as 03001234567
    expect(screen.getAllByText('Rs 4,000')[0].className).toContain('text-red-600');

    fireEvent.click(screen.getByRole('button', { name: 'Credit Given' }));
    expect(navigate).toHaveBeenCalledWith({ name: 'addEntry', customerId: 'ahmed', type: 'credit' });
    fireEvent.click(screen.getByRole('button', { name: 'Payment Received' }));
    expect(navigate).toHaveBeenCalledWith({ name: 'addEntry', customerId: 'ahmed', type: 'payment' });
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(navigate).toHaveBeenCalledWith({ name: 'editCustomer', customerId: 'ahmed' });
  });

  it('lists the history newest first, with running balances, notes and colours', () => {
    const { props } = makeProps();
    const { container } = render(<CustomerDetailScreen {...props} customerId="ahmed" />);
    const items = Array.from(container.querySelectorAll('section[aria-labelledby="history-heading"] li'));
    expect(items).toHaveLength(3);
    // Newest first, ordered by the entry's date then when it was recorded:
    // today's reversed credit (a3), today's credit (a1), then the old payment (a2).
    expect(items[0].textContent).toContain('Typed wrong amount');
    expect(items[1].textContent).toContain('Ration');
    expect(items[1].textContent).toContain('Balance:');
    expect(items[2].textContent).toContain('Payment');
  });

  it('shows a reversed entry struck through, labelled Reversed, with its reason and no correct button', () => {
    const { props } = makeProps();
    const { container } = render(<CustomerDetailScreen {...props} customerId="ahmed" />);
    const reversed = container.querySelector('section[aria-labelledby="history-heading"] li > .bg-gray-50');
    expect(reversed).not.toBeNull();
    expect(reversed?.textContent).toContain('Reversed');
    expect(reversed?.textContent).toContain('Reason: Typed wrong amount');
    expect(reversed?.querySelector('.line-through')).not.toBeNull();
    expect(reversed?.querySelector('button')).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Correct Mistake' })).toHaveLength(2);
  });

  it('opens the correction screen for a live entry', () => {
    const { props, navigate } = makeProps();
    render(<CustomerDetailScreen {...props} customerId="ahmed" />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Correct Mistake' })[0]); // newest live entry = a1 (Ration)
    expect(navigate).toHaveBeenCalledWith({ name: 'reverseEntry', entryId: 'a1', customerId: 'ahmed' });
  });

  it('offers WhatsApp and SMS reminders only when the customer owes and has a phone', () => {
    const { props } = makeProps();
    const owes = render(<CustomerDetailScreen {...props} customerId="ahmed" />);
    const whatsapp = screen.getByRole('link', { name: 'Send Reminder' });
    const href = whatsapp.getAttribute('href') ?? '';
    expect(href.startsWith('https://wa.me/923001234567?text=')).toBe(true);
    expect(decodeURIComponent(href)).toContain('Rs 4,000');
    expect(decodeURIComponent(href)).toContain('Ahmed Ali');
    expect(decodeURIComponent(href)).toContain('My Shop');
    expect(whatsapp.getAttribute('target')).toBe('_blank');
    expect(whatsapp.getAttribute('rel')).toContain('noopener');
    expect(screen.getByRole('link', { name: 'Send by SMS' }).getAttribute('href')).toMatch(
      /^sms:03001234567\?body=/,
    );
    owes.unmount();

    const noPhone = render(<CustomerDetailScreen {...props} customerId="tariq" />);
    expect(screen.queryByRole('link', { name: 'Send Reminder' })).toBeNull();
    expect(screen.getByText('Add a phone number to send reminders')).toBeTruthy();
    noPhone.unmount();

    const settled = render(<CustomerDetailScreen {...props} customerId="sara" />);
    expect(screen.queryByRole('link', { name: 'Send Reminder' })).toBeNull();
    expect(screen.queryByText('Add a phone number to send reminders')).toBeNull();
    settled.unmount();

    render(<CustomerDetailScreen {...props} customerId="fatima" />); // advance, has phone
    expect(screen.queryByRole('link', { name: 'Send Reminder' })).toBeNull();
  });

  it('writes the reminder in Urdu when the app is in Urdu', async () => {
    await i18n.changeLanguage('ur');
    const { props } = makeProps('ur');
    render(<CustomerDetailScreen {...props} customerId="ahmed" />);
    const href = screen.getByRole('link', { name: 'یاد دہانی بھیجیں' }).getAttribute('href') ?? '';
    expect(decodeURIComponent(href)).toContain('السلام علیکم');
    expect(decodeURIComponent(href)).toContain('میری دکان');
  });

  it('tells the user when the customer does not exist', () => {
    const { props } = makeProps();
    render(<CustomerDetailScreen {...props} customerId="ghost" />);
    expect(screen.getByText('Customer not found')).toBeTruthy();
  });
});

describe('Add entry', () => {
  async function submitAmount(text: string, type: 'credit' | 'payment' = 'credit') {
    const ctx = makeProps();
    render(<AddEntryScreen {...ctx.props} customerId="ahmed" type={type} />);
    fireEvent.change(screen.getByLabelText('Amount (Rs)'), { target: { value: text } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    return ctx;
  }

  it('saves a credit in paisa with todays date, then returns to the customer', async () => {
    const { add, navigate, onChanged } = await submitAmount('2000');
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ name: 'customerDetail', customerId: 'ahmed' }));
    expect(add).toHaveBeenCalledWith('creditGiven', { customerId: 'ahmed', amountPaisa: 200000, date: TODAY });
    expect(onChanged).toHaveBeenCalled();
  });

  it('saves a payment as paymentReceived', async () => {
    const { add, navigate } = await submitAmount('750', 'payment');
    await waitFor(() => expect(navigate).toHaveBeenCalled());
    expect(add).toHaveBeenCalledWith('paymentReceived', { customerId: 'ahmed', amountPaisa: 75000, date: TODAY });
  });

  it('accepts Urdu digits and thousand separators', async () => {
    const urdu = await submitAmount('۲۵۰۰');
    await waitFor(() => expect(urdu.add).toHaveBeenCalled());
    expect(urdu.add.mock.calls[0][1]).toMatchObject({ amountPaisa: 250000 });
  });

  it('keeps the note and a changed date', async () => {
    const { props, add, navigate } = makeProps();
    render(<AddEntryScreen {...props} customerId="ahmed" type="credit" />);
    fireEvent.change(screen.getByLabelText('Amount (Rs)'), { target: { value: '300' } });
    fireEvent.change(screen.getByLabelText('Note (optional)'), { target: { value: '  Sugar  ' } });
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-01-15' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(navigate).toHaveBeenCalled());
    expect(add).toHaveBeenCalledWith('creditGiven', {
      customerId: 'ahmed',
      amountPaisa: 30000,
      date: '2026-01-15',
      note: 'Sugar',
    });
  });

  it.each([
    ['', 'Amount is required'],
    ['0', 'Enter a whole number of rupees'],
    ['12.5', 'Enter a whole number of rupees'],
    ['-100', 'Enter a whole number of rupees'],
    ['abc', 'Enter a whole number of rupees'],
    ['12345678901', 'Enter a whole number of rupees'],
  ])('rejects the amount %j with a message', async (text, message) => {
    const { add } = await submitAmount(text);
    expect(screen.getByRole('alert').textContent).toContain(message);
    expect(add).not.toHaveBeenCalled();
  });

  it('rejects an empty date', () => {
    const { props, add } = makeProps();
    render(<AddEntryScreen {...props} customerId="ahmed" type="credit" />);
    fireEvent.change(screen.getByLabelText('Amount (Rs)'), { target: { value: '100' } });
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('alert').textContent).toBe('Enter a valid date');
    expect(add).not.toHaveBeenCalled();
  });

  it('defaults the date to today and uses a big numeric field', () => {
    const { props } = makeProps();
    render(<AddEntryScreen {...props} customerId="ahmed" type="credit" />);
    expect((screen.getByLabelText('Date') as HTMLInputElement).value).toBe(TODAY);
    const amount = screen.getByLabelText('Amount (Rs)') as HTMLInputElement;
    expect(amount.getAttribute('inputmode')).toBe('numeric');
    expect(amount.className).toContain('min-h-[56px]');
  });

  it('previews the amount as Rs with separators', () => {
    const { props } = makeProps();
    render(<AddEntryScreen {...props} customerId="ahmed" type="payment" />);
    fireEvent.change(screen.getByLabelText('Amount (Rs)'), { target: { value: '1250000' } });
    expect(screen.getByText('Rs 1,250,000')).toBeTruthy();
  });
});

describe('Reverse entry', () => {
  it('shows the original entry and requires a reason', () => {
    const { props, add } = makeProps();
    render(<ReverseEntryScreen {...props} customerId="ahmed" entryId="a1" />);
    expect(screen.getByText('Rs 5,000')).toBeTruthy();
    expect(screen.getByText('Ration')).toBeTruthy();
    expect(screen.getByText('Credit')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm Reversal' }));
    expect(screen.getByRole('alert').textContent).toBe('Reason is required');
    expect(add).not.toHaveBeenCalled();
  });

  it('appends an entryReversed record (never edits or deletes) and returns to the customer', async () => {
    const { props, add, navigate, onChanged } = makeProps();
    render(<ReverseEntryScreen {...props} customerId="ahmed" entryId="a1" />);
    fireEvent.change(screen.getByLabelText('Reason for reversal (required)'), { target: { value: ' Wrong amount ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Reversal' }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ name: 'customerDetail', customerId: 'ahmed' }));
    expect(add).toHaveBeenCalledTimes(1);
    expect(add).toHaveBeenCalledWith('entryReversed', { entryId: 'a1', reason: 'Wrong amount' });
    expect(onChanged).toHaveBeenCalled();
  });

  it('does not allow reversing an entry twice', () => {
    const { props } = makeProps();
    render(<ReverseEntryScreen {...props} customerId="ahmed" entryId="a3" />);
    expect(screen.getByText('This entry is already reversed')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Confirm Reversal' })).toBeNull();
  });

  it('handles an unknown entry', () => {
    const { props } = makeProps();
    render(<ReverseEntryScreen {...props} customerId="ahmed" entryId="nope" />);
    expect(screen.getByText('Entry not found')).toBeTruthy();
  });
});

describe('Reports', () => {
  it('defaults to this month and totals credit, payments and net (payments minus credit)', () => {
    const { props } = makeProps();
    render(<ReportsScreen {...props} />);
    const totals = within(screen.getByLabelText('Reports'));
    expect(totals.getByText('Rs 5,000').className).toContain('text-red-600'); // credit given (Rs 2,000 reversed excluded)
    expect(totals.getByText('Rs 500').className).toContain('text-green-700'); // payments received
    expect(totals.getByText('-Rs 4,500').className).toContain('text-red-600'); // net = 500 − 5,000
  });

  it('recalculates for another range and ignores entries outside it', () => {
    const { props } = makeProps();
    render(<ReportsScreen {...props} />);
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '1999-01-01' } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2000-12-31' } });
    // 2000-01-01: credits 1,500 + 1,000, payments 1,000 + 1,000
    const totals = within(screen.getByLabelText('Reports'));
    expect(totals.getByText('Rs 2,500')).toBeTruthy();
    expect(totals.getByText('Rs 2,000')).toBeTruthy();
    expect(totals.getByText('-Rs 500')).toBeTruthy();
  });

  it('warns when the start date is after the end date and shows no totals', () => {
    const { props } = makeProps();
    render(<ReportsScreen {...props} />);
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2999-01-01' } });
    expect(screen.getByRole('alert').textContent).toBe('The start date must not be after the end date');
    expect(screen.queryByText('Net (payments minus credit)')).toBeNull();
  });
});

describe('Settings', () => {
  it('saves the shop name as a settingsUpdated record', async () => {
    const { props, add, onChanged } = makeProps();
    render(<SettingsScreen {...props} />);
    fireEvent.change(screen.getByLabelText('Shop Name'), { target: { value: '  Ahmed General Store ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Saved'));
    expect(add).toHaveBeenCalledWith('settingsUpdated', { shopName: 'Ahmed General Store' });
    expect(onChanged).toHaveBeenCalled();
  });

  it('does not allow an empty shop name', () => {
    const { props, add } = makeProps();
    render(<SettingsScreen {...props} />);
    fireEvent.change(screen.getByLabelText('Shop Name'), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('alert').textContent).toBe('Shop name cannot be empty');
    expect(add).not.toHaveBeenCalled();
  });

  it('switches language through the radio buttons', () => {
    const { props, changeLanguage } = makeProps();
    render(<SettingsScreen {...props} />);
    expect((screen.getByLabelText('English') as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByLabelText('اردو'));
    expect(changeLanguage).toHaveBeenCalledWith('ur');
  });

  it('exports a CSV download without any network call', () => {
    const createObjectURL = vi.fn(() => 'blob:fake');
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const { props } = makeProps();
    render(<SettingsScreen {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Download Data (CSV)' }));

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blob = (createObjectURL.mock.calls[0] as unknown as [Blob])[0];
    expect(blob.type).toContain('text/csv');
    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake');
    expect(fetchSpy).not.toHaveBeenCalled();

    click.mockRestore();
    vi.unstubAllGlobals();
  });

  it('asks for confirmation before loading demo data, and Cancel adds nothing', () => {
    const { props, add } = makeProps();
    render(<SettingsScreen {...props} />);
    expect(screen.getByText('Adds sample data for demonstration')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Load Demo Data' }));
    expect(screen.getByRole('alertdialog').textContent).toContain('This will add sample customers');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(add).not.toHaveBeenCalled();
  });

  it('loads the demo data once confirmed and refreshes the app', async () => {
    const { props, add, onChanged } = makeProps();
    render(<SettingsScreen {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Load Demo Data' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, add sample data' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Sample data added'));
    expect(add.mock.calls.filter((c) => c[0] === 'customerCreated').length).toBeGreaterThanOrEqual(5);
    expect(add.mock.calls.some((c) => c[0] === 'entryReversed')).toBe(true);
    expect(onChanged).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Edge cases and protections
// ---------------------------------------------------------------------------

describe('Add customer: protection against bad input', () => {
  function fill(name: string, phone = '') {
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: name } });
    fireEvent.change(screen.getByLabelText('Phone (optional)'), { target: { value: phone } });
  }
  const save = () => fireEvent.click(screen.getByRole('button', { name: 'Save Customer' }));

  it('refuses a second customer with the same name AND phone number (ignoring case, spaces and hyphens)', () => {
    const { props, add } = makeProps();
    render(<AddCustomerScreen {...props} />);
    fill('  ahmed    ALI ', '0300 1234567');
    save();
    expect(screen.getByRole('alert').textContent).toBe('A customer with this name and phone number already exists');
    expect(add).not.toHaveBeenCalled();
  });

  it('allows the same name with a different phone, or no phone (there really are many people called Ali)', async () => {
    const { props, add, navigate } = makeProps();
    const first = render(<AddCustomerScreen {...props} />);
    fill('Ahmed Ali', '03009998887');
    save();
    await waitFor(() => expect(navigate).toHaveBeenCalledTimes(1));
    expect(add).toHaveBeenCalledWith('customerCreated', { name: 'Ahmed Ali', phone: '03009998887' });
    first.unmount();

    render(<AddCustomerScreen {...props} />);
    fill('Ahmed Ali');
    save();
    await waitFor(() => expect(navigate).toHaveBeenCalledTimes(2));
    expect(add).toHaveBeenLastCalledWith('customerCreated', { name: 'Ahmed Ali' });
  });

  it('editing a customer is not blocked by its own name and phone', async () => {
    const { props, navigate } = makeProps();
    render(<AddCustomerScreen {...props} customerId="ahmed" />);
    fireEvent.change(screen.getByLabelText('Note (optional)'), { target: { value: 'New note' } });
    save();
    await waitFor(() => expect(navigate).toHaveBeenCalled());
  });

  it('rejects a name or note that is too long', () => {
    const { props, add } = makeProps();
    render(<AddCustomerScreen {...props} />);
    fill('x'.repeat(61));
    save();
    expect(screen.getByRole('alert').textContent).toBe('Name can be at most 60 characters');
    fill('Ali');
    fireEvent.change(screen.getByLabelText('Note (optional)'), { target: { value: 'n'.repeat(301) } });
    save();
    expect(screen.getByRole('alert').textContent).toBe('Note can be at most 300 characters');
    expect(add).not.toHaveBeenCalled();
  });

  it('puts length limits on the fields themselves', () => {
    const { props } = makeProps();
    render(<AddCustomerScreen {...props} />);
    expect(screen.getByLabelText('Name').getAttribute('maxlength')).toBe('60');
    expect(screen.getByLabelText('Note (optional)').getAttribute('maxlength')).toBe('300');
  });

  it('tidies the name: trims it and squeezes repeated spaces', async () => {
    const { props, add, navigate } = makeProps();
    render(<AddCustomerScreen {...props} />);
    fill('  Muhammad    Ali  ');
    save();
    await waitFor(() => expect(navigate).toHaveBeenCalled());
    expect(add).toHaveBeenCalledWith('customerCreated', { name: 'Muhammad Ali' });
  });

  it('uses phone and numeric keyboards for the phone field', () => {
    const { props } = makeProps();
    render(<AddCustomerScreen {...props} />);
    const phone = screen.getByLabelText('Phone (optional)');
    expect(phone.getAttribute('type')).toBe('tel');
    expect(phone.getAttribute('inputmode')).toBe('tel');
  });

  it('a double tap on Save adds only one customer', async () => {
    const { props, add, navigate } = makeProps();
    let finish: () => void = () => {};
    add.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = () => resolve({ id: 'x', createdAt: '', deviceId: '', collection: 'customerCreated', payload: {} });
        }),
    );
    const { container } = render(<AddCustomerScreen {...props} />);
    fill('Bilal Hussain');
    const form = container.querySelector('form')!;
    fireEvent.submit(form);
    fireEvent.submit(form); // second tap while the first is still saving
    finish();
    await waitFor(() => expect(navigate).toHaveBeenCalledTimes(1));
    expect(add).toHaveBeenCalledTimes(1);
  });

  it('shows the phone in the edit form formatted, and saves it unformatted', async () => {
    const { props, add, navigate } = makeProps();
    render(<AddCustomerScreen {...props} customerId="ahmed" />);
    expect((screen.getByLabelText('Phone (optional)') as HTMLInputElement).value).toBe('0300-1234567');
    fireEvent.change(screen.getByLabelText('Phone (optional)'), { target: { value: '0321-5551234' } });
    save();
    await waitFor(() => expect(navigate).toHaveBeenCalled());
    expect(add).toHaveBeenCalledWith('customerUpdated', { customerId: 'ahmed', phone: '03215551234' });
  });
});

describe('Add entry: amount limits and double taps', () => {
  async function submit(text: string) {
    const ctx = makeProps();
    render(<AddEntryScreen {...ctx.props} customerId="ahmed" type="credit" />);
    fireEvent.change(screen.getByLabelText('Amount (Rs)'), { target: { value: text } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    return ctx;
  }

  it('accepts the largest allowed amount, Rs 999,999,999, and stores it exactly in paisa', async () => {
    const { add, navigate } = await submit('999999999');
    await waitFor(() => expect(navigate).toHaveBeenCalled());
    expect(add).toHaveBeenCalledWith('creditGiven', {
      customerId: 'ahmed',
      amountPaisa: 99_999_999_900,
      date: TODAY,
    });
  });

  it('rejects one rupee more than the limit', async () => {
    const { add } = await submit('1000000000');
    expect(screen.getByRole('alert').textContent).toContain('Enter a whole number of rupees');
    expect(add).not.toHaveBeenCalled();
  });

  it.each(['0', '00', '-5', '+5', '1e5', '1.0', '٫5', ' ', '१२३'])('rejects %j', async (text) => {
    const { add } = await submit(text);
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(add).not.toHaveBeenCalled();
  });

  it('accepts a leading zero and thousand separators', async () => {
    const { add, navigate } = await submit('01,250');
    await waitFor(() => expect(navigate).toHaveBeenCalled());
    expect(add.mock.calls[0][1]).toMatchObject({ amountPaisa: 125000 });
  });

  it('rejects a note that is too long', () => {
    const { props, add } = makeProps();
    render(<AddEntryScreen {...props} customerId="ahmed" type="payment" />);
    fireEvent.change(screen.getByLabelText('Amount (Rs)'), { target: { value: '100' } });
    fireEvent.change(screen.getByLabelText('Note (optional)'), { target: { value: 'n'.repeat(301) } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('alert').textContent).toBe('Note can be at most 300 characters');
    expect(add).not.toHaveBeenCalled();
  });

  it('a double tap on Save records only ONE entry (otherwise the balance would be wrong)', async () => {
    const { props, add, navigate } = makeProps();
    let finish: () => void = () => {};
    add.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = () => resolve({ id: 'x', createdAt: '', deviceId: '', collection: 'creditGiven', payload: {} });
        }),
    );
    const { container } = render(<AddEntryScreen {...props} customerId="ahmed" type="credit" />);
    fireEvent.change(screen.getByLabelText('Amount (Rs)'), { target: { value: '500' } });
    const form = container.querySelector('form')!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    fireEvent.submit(form);
    finish();
    await waitFor(() => expect(navigate).toHaveBeenCalledTimes(1));
    expect(add).toHaveBeenCalledTimes(1);
  });

  it('shows an error and keeps what was typed if saving fails, then lets the user try again', async () => {
    const { props, add, navigate } = makeProps();
    add.mockRejectedValueOnce(new Error('quota exceeded'));
    render(<AddEntryScreen {...props} customerId="ahmed" type="credit" />);
    fireEvent.change(screen.getByLabelText('Amount (Rs)'), { target: { value: '700' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Something went wrong'));
    expect((screen.getByLabelText('Amount (Rs)') as HTMLInputElement).value).toBe('700');
    expect(navigate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(navigate).toHaveBeenCalled());
  });

  it('handles an unknown customer without crashing', () => {
    const { props } = makeProps();
    render(<AddEntryScreen {...props} customerId="ghost" type="credit" />);
    expect(screen.getByText('Customer not found')).toBeTruthy();
  });
});

describe('Reverse entry: double tap', () => {
  it('records only one reversal', async () => {
    const { props, add, navigate } = makeProps();
    let finish: () => void = () => {};
    add.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = () => resolve({ id: 'x', createdAt: '', deviceId: '', collection: 'entryReversed', payload: {} });
        }),
    );
    const { container } = render(<ReverseEntryScreen {...props} customerId="ahmed" entryId="a1" />);
    fireEvent.change(screen.getByLabelText('Reason for reversal (required)'), { target: { value: 'typo' } });
    const form = container.querySelector('form')!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    finish();
    await waitFor(() => expect(navigate).toHaveBeenCalledTimes(1));
    expect(add).toHaveBeenCalledTimes(1);
  });

  it('rejects a reason that is too long', () => {
    const { props, add } = makeProps();
    render(<ReverseEntryScreen {...props} customerId="ahmed" entryId="a1" />);
    fireEvent.change(screen.getByLabelText('Reason for reversal (required)'), { target: { value: 'r'.repeat(201) } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Reversal' }));
    expect(screen.getByRole('alert').textContent).toBe('Reason can be at most 200 characters');
    expect(add).not.toHaveBeenCalled();
  });
});

describe('Long text never breaks the layout or crashes', () => {
  it('shows a very long name, note and reason in full on the detail screen, wrapped (not cut off)', () => {
    const longName = 'Muhammad'.repeat(12);
    const longNote = 'word '.repeat(60) + 'x'.repeat(120);
    const data: KhataData = {
      ...DATA,
      customerCreated: [rec('customerCreated', { name: longName, note: longNote }, 'long', 1)],
      creditGiven: [rec('creditGiven', { customerId: 'long', amountPaisa: 100000, date: TODAY, note: longNote }, 'l1', 2)],
      paymentReceived: [],
      entryReversed: [],
    };
    const { props } = makeProps();
    const { container } = render(
      <CustomerDetailScreen {...props} data={data} derived={deriveAll(data, TODAY)} customerId="long" />,
    );
    expect(container.textContent).toContain(longName);
    const title = screen.getByRole('heading', { level: 2 });
    expect(title.className).toContain('break-words');
    expect(title.className).not.toContain('truncate');
    expect(container.querySelectorAll('p.break-words').length).toBeGreaterThan(0);
  });

  it('shrinks very large amounts so they fit a 360px screen', () => {
    const data: KhataData = {
      ...DATA,
      creditGiven: [
        rec('creditGiven', { customerId: 'ahmed', amountPaisa: 99_999_999_900, date: TODAY }, 'big1', 20),
        rec('creditGiven', { customerId: 'ahmed', amountPaisa: 99_999_999_900, date: TODAY }, 'big2', 21),
        rec('creditGiven', { customerId: 'ahmed', amountPaisa: 99_999_999_900, date: TODAY }, 'big3', 22),
      ],
      paymentReceived: [],
      entryReversed: [],
    };
    const { props } = makeProps();
    render(<CustomerDetailScreen {...props} data={data} derived={deriveAll(data, TODAY)} customerId="ahmed" />);
    const hero = screen.getAllByText('Rs 2,999,999,997')[0];
    expect(hero.className).not.toContain('text-4xl'); // 15+ characters: a smaller size is chosen
    expect(hero.className).toContain('whitespace-nowrap');
  });
});

// ---------------------------------------------------------------------------
// New features
// ---------------------------------------------------------------------------

describe('Dashboard: customers who owe money', () => {
  it('says how many customers owe, under Total Outstanding', () => {
    const { props } = makeProps();
    render(<DashboardScreen {...props} />);
    expect(screen.getByText('2 customers owe you money')).toBeTruthy(); // Ahmed and Tariq
  });

  it('uses the singular for one customer', () => {
    const data: KhataData = { ...DATA, creditGiven: DATA.creditGiven.filter((c) => c.id !== 't1') };
    const { props } = makeProps();
    render(<DashboardScreen {...props} data={data} derived={deriveAll(data, TODAY)} />);
    expect(screen.getByText('1 customer owes you money')).toBeTruthy();
  });

  it('says everyone is settled when nobody owes', () => {
    const data: KhataData = { ...DATA, creditGiven: [], paymentReceived: [], entryReversed: [] };
    const { props } = makeProps();
    render(<DashboardScreen {...props} data={data} derived={deriveAll(data, TODAY)} />);
    expect(screen.getByText('Everyone is settled')).toBeTruthy();
  });

  it('reads naturally in Urdu', async () => {
    await i18n.changeLanguage('ur');
    const { props } = makeProps('ur');
    render(<DashboardScreen {...props} />);
    expect(screen.getByText('2 گاہکوں کا بقایا ہے')).toBeTruthy();
  });

  it('every top-debtor row opens that customer', () => {
    const { props, navigate } = makeProps();
    render(<DashboardScreen {...props} />);
    fireEvent.click(screen.getByText('Tariq Mehmood'));
    expect(navigate).toHaveBeenCalledWith({ name: 'customerDetail', customerId: 'tariq' });
  });

  it('welcomes a new shop with a friendly first step instead of empty cards', () => {
    const empty: KhataData = {
      customerCreated: [],
      customerUpdated: [],
      creditGiven: [],
      paymentReceived: [],
      entryReversed: [],
      settingsUpdated: [],
    };
    const { props, navigate } = makeProps();
    render(<DashboardScreen {...props} data={empty} derived={deriveAll(empty, TODAY)} />);
    expect(screen.getByText('Welcome to Khata')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Add your first customer' }));
    expect(navigate).toHaveBeenCalledWith({ name: 'addCustomer' });
    fireEvent.click(screen.getByRole('button', { name: 'Try with demo data' }));
    expect(navigate).toHaveBeenCalledWith({ name: 'settings' });
  });
});

describe('Customers list: friendly empty states', () => {
  it('offers to add the first customer', () => {
    const empty: KhataData = { ...DATA, customerCreated: [], creditGiven: [], paymentReceived: [], entryReversed: [] };
    const { props, navigate } = makeProps();
    render(<CustomerListScreen {...props} data={empty} derived={deriveAll(empty, TODAY)} />);
    expect(screen.getByText('No customers yet')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Add Customer' }));
    expect(navigate).toHaveBeenCalledWith({ name: 'addCustomer' });
  });

  it('a search with no match offers to add that person', () => {
    const { props, navigate } = makeProps();
    render(<CustomerListScreen {...props} />);
    fireEvent.change(screen.getByLabelText('Search name or phone'), { target: { value: 'zzz' } });
    expect(screen.getByText('No customer found')).toBeTruthy();
    const buttons = screen.getAllByRole('button', { name: 'Add Customer' });
    fireEvent.click(buttons[buttons.length - 1]);
    expect(navigate).toHaveBeenCalledWith({ name: 'addCustomer' });
  });

  it('a customer with no transactions invites the first entry', () => {
    const data: KhataData = { ...DATA, creditGiven: [], paymentReceived: [], entryReversed: [] };
    const { props, navigate } = makeProps();
    render(<CustomerDetailScreen {...props} data={data} derived={deriveAll(data, TODAY)} customerId="ahmed" />);
    expect(screen.getByText('No transactions yet')).toBeTruthy();
    const creditButtons = screen.getAllByRole('button', { name: 'Credit Given' });
    fireEvent.click(creditButtons[creditButtons.length - 1]);
    expect(navigate).toHaveBeenLastCalledWith({ name: 'addEntry', customerId: 'ahmed', type: 'credit' });
  });
});

describe('Quick entry', () => {
  it('search, pick a customer, choose Credit Given, enter the amount, save', async () => {
    const { props, add, navigate, onChanged } = makeProps();
    render(<QuickEntryScreen {...props} from="dashboard" />);

    fireEvent.change(screen.getByLabelText('Search customer by name or phone'), { target: { value: 'tariq' } });
    expect(screen.queryByText('Ahmed Ali')).toBeNull();
    fireEvent.click(screen.getByText('Tariq Mehmood'));

    expect(screen.getByText('Tariq Mehmood')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Credit Given' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.change(screen.getByLabelText('Amount (Rs)'), { target: { value: '1250' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ name: 'customerDetail', customerId: 'tariq' }));
    expect(add).toHaveBeenCalledWith('creditGiven', { customerId: 'tariq', amountPaisa: 125000, date: TODAY });
    expect(onChanged).toHaveBeenCalled();
  });

  it('can record a payment instead', async () => {
    const { props, add, navigate } = makeProps();
    render(<QuickEntryScreen {...props} from="customerList" />);
    fireEvent.click(screen.getByText('Ahmed Ali'));
    fireEvent.click(screen.getByRole('button', { name: 'Payment Received' }));
    expect(screen.getByRole('button', { name: 'Payment Received' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Credit Given' }).getAttribute('aria-pressed')).toBe('false');
    fireEvent.change(screen.getByLabelText('Amount (Rs)'), { target: { value: '650' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(navigate).toHaveBeenCalled());
    expect(add).toHaveBeenCalledWith('paymentReceived', { customerId: 'ahmed', amountPaisa: 65000, date: TODAY });
  });

  it('keeps the amount typed when the type is switched', () => {
    const { props } = makeProps();
    render(<QuickEntryScreen {...props} from="dashboard" />);
    fireEvent.click(screen.getByText('Ahmed Ali'));
    fireEvent.change(screen.getByLabelText('Amount (Rs)'), { target: { value: '900' } });
    fireEvent.click(screen.getByRole('button', { name: 'Payment Received' }));
    expect((screen.getByLabelText('Amount (Rs)') as HTMLInputElement).value).toBe('900');
  });

  it('lets you change the customer', () => {
    const { props } = makeProps();
    render(<QuickEntryScreen {...props} from="dashboard" />);
    fireEvent.click(screen.getByText('Ahmed Ali'));
    fireEvent.click(screen.getByRole('button', { name: 'Change' }));
    expect(screen.getByText('Choose a customer')).toBeTruthy();
    expect(screen.getByText('Sara Begum')).toBeTruthy();
  });

  it('Back returns to where it was opened from', () => {
    const { props, navigate } = makeProps();
    render(<QuickEntryScreen {...props} from="customerList" />);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(navigate).toHaveBeenCalledWith({ name: 'customerList' });
  });

  it('with no customers it asks you to add one first', () => {
    const empty: KhataData = { ...DATA, customerCreated: [], creditGiven: [], paymentReceived: [], entryReversed: [] };
    const { props, navigate } = makeProps();
    render(<QuickEntryScreen {...props} data={empty} derived={deriveAll(empty, TODAY)} from="dashboard" />);
    expect(screen.getByText('Add a customer first')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Add Customer' }));
    expect(navigate).toHaveBeenCalledWith({ name: 'addCustomer' });
  });

  it('a search with no match offers to add the customer', () => {
    const { props, navigate } = makeProps();
    render(<QuickEntryScreen {...props} from="dashboard" />);
    fireEvent.change(screen.getByLabelText('Search customer by name or phone'), { target: { value: 'nobody' } });
    expect(screen.getByText('No customer found')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Add Customer' }));
    expect(navigate).toHaveBeenCalledWith({ name: 'addCustomer' });
  });

  it('validates the amount like every other entry form', () => {
    const { props, add } = makeProps();
    render(<QuickEntryScreen {...props} from="dashboard" />);
    fireEvent.click(screen.getByText('Ahmed Ali'));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('alert').textContent).toBe('Amount is required');
    expect(add).not.toHaveBeenCalled();
  });
});

describe('Reports: quick ranges, chart and per-customer breakdown', () => {
  const anchor = new Date(`${TODAY}T12:00:00`);

  it('starts on This Month, marked as selected', () => {
    const { props } = makeProps();
    render(<ReportsScreen {...props} />);
    expect(screen.getByRole('button', { name: 'This Month' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Today' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('Today sets both dates to today and shows only today’s entries', () => {
    const { props } = makeProps();
    render(<ReportsScreen {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Today' }));
    expect((screen.getByLabelText('From') as HTMLInputElement).value).toBe(TODAY);
    expect((screen.getByLabelText('To') as HTMLInputElement).value).toBe(TODAY);
    expect(screen.getByRole('button', { name: 'Today' }).getAttribute('aria-pressed')).toBe('true');
    const totals = within(screen.getByLabelText('Reports'));
    expect(totals.getByText('Rs 5,000')).toBeTruthy(); // Ahmed's credit today (the reversed Rs 2,000 is excluded)
    expect(totals.getByText('Rs 500')).toBeTruthy(); // Fatima's payment today
  });

  it('This Week sets Monday to Sunday', async () => {
    const { weekRange } = await import('@skeleton/core');
    const { props } = makeProps();
    render(<ReportsScreen {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'This Week' }));
    const week = weekRange(anchor);
    expect((screen.getByLabelText('From') as HTMLInputElement).value).toBe(week.from);
    expect((screen.getByLabelText('To') as HTMLInputElement).value).toBe(week.to);
    expect(screen.getByRole('button', { name: 'This Week' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('switching back to This Month restores the month', async () => {
    const { monthRange } = await import('@skeleton/core');
    const { props } = makeProps();
    render(<ReportsScreen {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Today' }));
    fireEvent.click(screen.getByRole('button', { name: 'This Month' }));
    expect((screen.getByLabelText('From') as HTMLInputElement).value).toBe(monthRange(anchor).from);
  });

  it('typing a custom date deselects the quick buttons', () => {
    const { props } = makeProps();
    render(<ReportsScreen {...props} />);
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2000-01-01' } });
    for (const name of ['Today', 'This Week', 'This Month']) {
      expect(screen.getByRole('button', { name }).getAttribute('aria-pressed')).toBe('false');
    }
  });

  it('draws an accessible SVG bar chart with a legend and no chart library', () => {
    const { props } = makeProps();
    const { container } = render(<ReportsScreen {...props} />);
    const chart = screen.getByRole('img', { name: 'Bar chart of credit given and payments received per day' });
    expect(chart.tagName.toLowerCase()).toBe('svg');
    expect(container.querySelectorAll('svg[role="img"] rect').length).toBeGreaterThanOrEqual(2);
    expect(container.innerHTML).not.toContain('NaN');
    const legend = within(chart.parentElement as HTMLElement);
    expect(legend.getByText('Credit Given')).toBeTruthy();
    expect(legend.getByText('Payments Received')).toBeTruthy();
    expect(screen.getByText(/Credit given Rs 5,000, payments received Rs 500\./)).toBeTruthy();
  });

  it('lists each customer’s credit and payments for the range, and opens a customer when tapped', () => {
    const { props, navigate } = makeProps();
    render(<ReportsScreen {...props} />);
    const breakdown = within(document.querySelector('section[aria-labelledby="breakdown-heading"]') as HTMLElement);
    expect(breakdown.getByText('Ahmed Ali')).toBeTruthy();
    expect(breakdown.getByText('Fatima Noor')).toBeTruthy();
    expect(breakdown.queryByText('Sara Begum')).toBeNull(); // her entries are from 2000
    fireEvent.click(breakdown.getByText('Ahmed Ali'));
    expect(navigate).toHaveBeenCalledWith({ name: 'customerDetail', customerId: 'ahmed' });
  });

  it('shows a friendly empty state with an action when the period has no transactions', () => {
    const { props, navigate } = makeProps();
    render(<ReportsScreen {...props} />);
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '1990-01-01' } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '1990-01-31' } });
    expect(screen.getByText('No transactions in this period')).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Record an entry' }));
    expect(navigate).toHaveBeenCalledWith({ name: 'quickEntry', from: 'reports' });
  });

  it('draws nothing and shows an error for a backwards range', () => {
    const { props } = makeProps();
    render(<ReportsScreen {...props} />);
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2999-01-01' } });
    expect(screen.getByRole('alert').textContent).toBe('The start date must not be after the end date');
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('keeps the chart readable in Urdu: left-to-right so dates read correctly', async () => {
    await i18n.changeLanguage('ur');
    const { props } = makeProps('ur');
    render(<ReportsScreen {...props} />);
    const chart = screen.getByRole('img');
    expect(chart.parentElement?.getAttribute('dir')).toBe('ltr');
    expect(screen.getByRole('button', { name: 'آج' }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('button', { name: 'اس مہینے' }).getAttribute('aria-pressed')).toBe('true');
  });
});

describe('Settings: demo data and clear all data', () => {
  it('says so, and opens no dialog, when the demo data is already loaded', () => {
    const loaded: KhataData = {
      ...DATA,
      settingsUpdated: [rec('settingsUpdated', { demoDataLoaded: true }, 'marker', 30)],
    };
    const { props, add } = makeProps();
    render(<SettingsScreen {...props} data={loaded} derived={deriveAll(loaded, TODAY)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Load Demo Data' }));
    expect(screen.getByRole('status').textContent).toContain('Sample data is already loaded');
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(add).not.toHaveBeenCalled();
  });

  it('if the marker is found while loading, reports "already loaded" and adds nothing', async () => {
    const { props, add } = makeProps();
    // The screen believed no demo data existed, but the store says it does (another phone synced it).
    (props.store.query as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      rec('settingsUpdated', { demoDataLoaded: true }, 'marker', 1),
    ]);
    render(<SettingsScreen {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Load Demo Data' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, add sample data' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('already loaded'));
    expect(add).not.toHaveBeenCalled();
  });

  it('"Clear all data" is a red danger action in its own section', () => {
    const { props } = makeProps();
    render(<SettingsScreen {...props} />);
    expect(screen.getByText('Danger zone')).toBeTruthy();
    const button = screen.getByRole('button', { name: 'Clear all data' });
    expect(button.className).toContain('text-red-700');
    expect(button.className).toContain('border-red-300');
  });

  it('asks for confirmation, warns it cannot be undone, and focuses the safe choice (Cancel)', () => {
    const { props, onClearAll } = makeProps();
    render(<SettingsScreen {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Clear all data' }));
    const dialog = screen.getByRole('alertdialog');
    expect(dialog.textContent).toContain('Delete all data?');
    expect(dialog.textContent).toContain('cannot be undone');
    expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(onClearAll).not.toHaveBeenCalled();
  });

  it('Cancel, Escape and tapping outside all keep the data', () => {
    const { props, onClearAll } = makeProps();
    render(<SettingsScreen {...props} />);

    fireEvent.click(screen.getByRole('button', { name: 'Clear all data' }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Clear all data' }));
    fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape' });
    expect(screen.queryByRole('alertdialog')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Clear all data' }));
    fireEvent.mouseDown(screen.getByRole('alertdialog').parentElement as HTMLElement);
    expect(screen.queryByRole('alertdialog')).toBeNull();

    expect(onClearAll).not.toHaveBeenCalled();
  });

  it('confirming clears the data once and tells the user', async () => {
    const { props, onClearAll } = makeProps();
    render(<SettingsScreen {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Clear all data' }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Yes, delete everything' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('All data was deleted'));
    expect(onClearAll).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('shows an error and keeps the dialog flow safe if clearing fails', async () => {
    const { props, onClearAll } = makeProps();
    onClearAll.mockRejectedValueOnce(new Error('blocked'));
    render(<SettingsScreen {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Clear all data' }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Yes, delete everything' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Something went wrong'));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('rejects a shop name that is too long', () => {
    const { props, add } = makeProps();
    render(<SettingsScreen {...props} />);
    fireEvent.change(screen.getByLabelText('Shop Name'), { target: { value: 's'.repeat(61) } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('alert').textContent).toBe('Shop name can be at most 60 characters');
    expect(add).not.toHaveBeenCalled();
  });
});
