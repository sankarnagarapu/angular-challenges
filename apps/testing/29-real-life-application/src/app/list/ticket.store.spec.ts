import { TestBed } from '@angular/core/testing';
import { provideComponentStore } from '@ngrx/component-store';
import { waitFor } from '@testing-library/angular';
import { of, throwError } from 'rxjs';
import { BackendService, Ticket, TicketUser, User } from '../backend.service';
import { TicketStore } from './ticket.store';

const USERS: User[] = [
  { id: 1, name: 'Titi' },
  { id: 2, name: 'George' },
];

const TICKETS: Ticket[] = [
  {
    id: 0,
    description: 'Install a monitor arm',
    assigneeId: 1,
    completed: false,
  },
  {
    id: 1,
    description: 'Coucou',
    assigneeId: null,
    completed: false,
  },
];

type BackendMock = Pick<
  BackendService,
  'users' | 'tickets' | 'newTicket' | 'assign' | 'complete'
>;

type TicketView = Ticket | TicketUser;

type TicketVm = {
  tickets: TicketView[];
  users: User[];
  loading: boolean;
  error: unknown;
};

function createBackendMock(
  overrides: Partial<Record<keyof BackendMock, jest.Mock>> = {},
): jest.Mocked<BackendMock> {
  return {
    users: jest.fn(() => of(USERS)),
    tickets: jest.fn(() => of(TICKETS)),
    newTicket: jest.fn(({ description }: { description: string }) =>
      of({
        id: 2,
        description,
        assigneeId: null,
        completed: false,
      }),
    ),
    assign: jest.fn((ticketId: number, userId: number) =>
      of({
        ...TICKETS.find((ticket) => ticket.id === ticketId)!,
        assigneeId: userId,
      }),
    ),
    complete: jest.fn((ticketId: number, completed: boolean) =>
      of({
        ...TICKETS.find((ticket) => ticket.id === ticketId)!,
        completed,
      }),
    ),
    ...overrides,
  };
}

function setupStore(
  overrides: Partial<Record<keyof BackendMock, jest.Mock>> = {},
) {
  const backend = createBackendMock(overrides);

  TestBed.configureTestingModule({
    providers: [
      provideComponentStore(TicketStore),
      { provide: BackendService, useValue: backend },
    ],
  });

  return {
    backend,
    store: TestBed.inject(TicketStore),
  };
}

async function readVm(store: TicketStore, assertion: (vm: TicketVm) => void) {
  let latest: TicketVm | undefined;
  const subscription = store.vm$.subscribe((vm) => {
    latest = vm;
  });

  await waitFor(() => {
    expect(latest).toBeDefined();
    assertion(latest!);
  });

  subscription.unsubscribe();
  return latest!;
}

describe('TicketStore', () => {
  describe('When init', () => {
    it('Then calls backend.users', async () => {
      const { backend, store } = setupStore();

      await readVm(store, (vm) => expect(vm.users).toHaveLength(2));

      expect(backend.users).toHaveBeenCalledTimes(1);
    });

    it('Then calls backend.tickets', async () => {
      const { backend, store } = setupStore();

      await readVm(store, (vm) => expect(vm.tickets).toHaveLength(2));

      expect(backend.tickets).toHaveBeenCalledTimes(1);
    });

    describe('Given all api returns success response', () => {
      it('Then tickets and users should be merged ', async () => {
        const { store } = setupStore();

        await readVm(store, (vm) => {
          expect(vm.tickets).toEqual([
            {
              id: 0,
              description: 'Install a monitor arm',
              assigneeId: 1,
              completed: false,
              assignee: 'Titi',
            },
            {
              id: 1,
              description: 'Coucou',
              assigneeId: null,
              completed: false,
              assignee: 'unassigned',
            },
          ]);
        });
      });
    });

    describe('Given users api returns failure response', () => {
      it('Then tickets should not have any assignee', () => {
        const { store } = setupStore({
          users: jest.fn(() =>
            throwError(() => new Error('Could not load users')),
          ),
        });

        return readVm(store, (vm) => {
          expect(vm.tickets).toHaveLength(2);
          expect('assignee' in vm.tickets[0]).toBe(false);
          expect(vm.error).toEqual(new Error('Could not load users'));
        });
      });
    });

    describe('When adding a new ticket with success', () => {
      it('Then ticket is added to the list', async () => {
        const { backend, store } = setupStore();

        await readVm(store, (vm) => expect(vm.tickets).toHaveLength(2));

        store.addTicket('Write tests');

        await readVm(store, (vm) => {
          expect(vm.tickets).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                id: 2,
                description: 'Write tests',
                assignee: 'unassigned',
              }),
            ]),
          );
        });
        expect(backend.newTicket).toHaveBeenCalledWith({
          description: 'Write tests',
        });
      });
    });
  });
});
