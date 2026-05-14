import { Component } from '@angular/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { render, screen, waitFor } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { RowComponent } from './row.component';

const USERS = [
  { id: 1, name: 'titi' },
  { id: 2, name: 'George' },
];

const TICKET_NOT_ASSIGNED = {
  id: 0,
  description: 'Install a monitor arm',
  assignee: 'unassigned',
  completed: false,
};

const TICKET_ASSIGNED = {
  id: 1,
  description: 'Install a monitor arm',
  assignee: 'titi',
  completed: false,
};

@Component({
  template: '',
})
class EmptyComponent {}

async function setup(ticket = TICKET_NOT_ASSIGNED) {
  const user = userEvent.setup();
  const renderResult = await render(RowComponent, {
    imports: [
      NoopAnimationsModule,
      RouterTestingModule.withRoutes([
        { path: 'detail/:ticketId', component: EmptyComponent },
      ]),
    ],
    componentInputs: {
      ticket,
      users: USERS,
    },
  });

  return {
    user,
    router: renderResult.fixture.debugElement.injector.get(Router),
    assign: jest.spyOn(renderResult.fixture.componentInstance.assign, 'emit'),
    closeTicket: jest.spyOn(
      renderResult.fixture.componentInstance.closeTicket,
      'emit',
    ),
  };
}

describe('RowComponent', () => {
  describe('Given an unassigned ticket', () => {
    describe('When we assign it to titi', () => {
      it('Then assign event is emitted with ticketId 0 and userId 1', async () => {
        const { assign, user } = await setup();

        await user.click(screen.getByRole('combobox', { name: /assign to/i }));
        await user.click(await screen.findByRole('option', { name: 'titi' }));
        await user.click(screen.getByRole('button', { name: /^assign$/i }));

        expect(assign).toHaveBeenCalledWith({ ticketId: 0, userId: 1 });
      });
    });
  });

  describe('Given an assigned ticket', () => {
    describe('When we click the done button', () => {
      it('Then closeTicket event is emitted with ticketId 1 ', async () => {
        const { closeTicket, user } = await setup(TICKET_ASSIGNED);

        await user.click(screen.getByRole('button', { name: /^done$/i }));

        expect(closeTicket).toHaveBeenCalledWith(1);
      });
    });
  });

  describe('When clicking on ticket', () => {
    it('Then navigation should be triggered with url detail/0', async () => {
      const { router, user } = await setup();

      await user.click(
        screen.getByRole('button', { name: /install a monitor arm/i }),
      );

      await waitFor(() => expect(router.url).toBe('/detail/0'));
    });
  });
});
