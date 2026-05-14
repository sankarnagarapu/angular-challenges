import { Component } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { render, screen, waitFor, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of, throwError } from 'rxjs';
import { BackendService, Ticket, User } from '../backend.service';
import { ListComponent } from './list.component';

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

@Component({
  template: '',
})
class EmptyComponent {}

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

async function setup(
  overrides: Partial<Record<keyof BackendMock, jest.Mock>> = {},
) {
  const backend = createBackendMock(overrides);
  const user = userEvent.setup();
  const renderResult = await render(ListComponent, {
    imports: [
      ReactiveFormsModule,
      NoopAnimationsModule,
      RouterTestingModule.withRoutes([
        { path: 'detail/:ticketId', component: EmptyComponent },
      ]),
    ],
    providers: [{ provide: BackendService, useValue: backend }],
  });

  await screen.findByText('Install a monitor arm');

  return {
    backend,
    user,
    router: renderResult.fixture.debugElement.injector.get(Router),
  };
}

describe('ListComponent', () => {
  describe('Given Install inside the search input', () => {
    it('Then one row is visible', async () => {
      const { user } = await setup();

      await user.type(screen.getByLabelText(/search/i), 'Install');

      expect(screen.getByText('Install a monitor arm')).toBeInTheDocument();
      await waitFor(() =>
        expect(screen.queryByText('Coucou')).not.toBeInTheDocument(),
      );
      expect(screen.getAllByRole('listitem')).toHaveLength(1);
    });
  });

  describe('When typing a description and clicking on add a new ticket', () => {
    describe('Given a success answer from API', () => {
      it('Then ticket with the description is added to the list with unassigned status', async () => {
        const { backend, user } = await setup();

        await user.type(screen.getByLabelText(/description/i), 'Write tests');
        await user.click(
          screen.getByRole('button', { name: /add new ticket/i }),
        );

        expect(backend.newTicket).toHaveBeenCalledWith({
          description: 'Write tests',
        });
        expect(await screen.findByText('Write tests')).toBeInTheDocument();
        expect(screen.getAllByText('unassigned')).toHaveLength(2);
      });
    });

    describe('Given a failure answer from API', () => {
      it('Then an error is displayed at the bottom of the list', async () => {
        const { user } = await setup({
          newTicket: jest.fn(() =>
            throwError(() => new Error('Could not add ticket')),
          ),
        });

        await user.type(screen.getByLabelText(/description/i), 'Write tests');
        await user.click(
          screen.getByRole('button', { name: /add new ticket/i }),
        );

        expect(await screen.findByText(/Could not add ticket/)).toBeVisible();
      });
    });
  });

  describe('When assigning first ticket to george', () => {
    describe('Given a success answer from API', () => {
      it('Then first ticket is assigned to George', async () => {
        const { backend, user } = await setup();
        const firstRow = screen.getAllByRole('listitem')[0];

        await user.click(
          within(firstRow).getByRole('combobox', { name: /assign to/i }),
        );
        await user.click(await screen.findByRole('option', { name: 'George' }));
        await user.click(
          within(firstRow).getByRole('button', { name: /^assign$/i }),
        );

        expect(backend.assign).toHaveBeenCalledWith(0, 2);
        await waitFor(() =>
          expect(firstRow).toHaveTextContent(/Assignee:\s*George/),
        );
      });
    });

    describe('Given a failure answer from API', () => {
      it('Then an error is displayed at the bottom of the list', async () => {
        const { user } = await setup({
          assign: jest.fn(() =>
            throwError(() => new Error('Could not assign ticket')),
          ),
        });
        const firstRow = screen.getAllByRole('listitem')[0];

        await user.click(
          within(firstRow).getByRole('combobox', { name: /assign to/i }),
        );
        await user.click(await screen.findByRole('option', { name: 'George' }));
        await user.click(
          within(firstRow).getByRole('button', { name: /^assign$/i }),
        );

        expect(
          await screen.findByText(/Could not assign ticket/),
        ).toBeVisible();
      });
    });
  });

  describe('When finishing first ticket', () => {
    describe('Given a success answer from API', () => {
      it('Then first ticket is done', async () => {
        const { backend, user } = await setup();
        const firstRow = screen.getAllByRole('listitem')[0];

        await user.click(
          within(firstRow).getByRole('button', { name: 'Done' }),
        );

        expect(backend.complete).toHaveBeenCalledWith(0, true);
        await waitFor(() =>
          expect(screen.getAllByRole('listitem')[0]).toHaveTextContent(
            /Done:\s*true/,
          ),
        );
      });
    });

    describe('Given a failure answer from API', () => {
      it('Then an error is displayed at the bottom of the list', async () => {
        const { user } = await setup({
          complete: jest.fn(() =>
            throwError(() => new Error('Could not close ticket')),
          ),
        });
        const firstRow = screen.getAllByRole('listitem')[0];

        await user.click(
          within(firstRow).getByRole('button', { name: 'Done' }),
        );

        expect(await screen.findByText(/Could not close ticket/)).toBeVisible();
      });
    });
  });

  describe('When clicking on first ticket', () => {
    it('Then we navigate to detail/0', async () => {
      const { router, user } = await setup();
      const firstRow = screen.getAllByRole('listitem')[0];

      await user.click(
        within(firstRow).getByRole('button', {
          name: /install a monitor arm/i,
        }),
      );

      await waitFor(() => expect(router.url).toBe('/detail/0'));
    });
  });
});
