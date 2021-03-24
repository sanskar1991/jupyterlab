// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import {
  Toolbar,
  ToolbarButton,
  CommandToolbarButton,
  SessionContext
} from '@jupyterlab/apputils';

import { toArray } from '@lumino/algorithm';

import { CommandRegistry } from '@lumino/commands';

import { ReadonlyPartialJSONObject } from '@lumino/coreutils';

import { Widget } from '@lumino/widgets';

import { simulate } from 'simulate-event';

import {
  createSessionContext,
  framePromise,
  JupyterServer
} from '@jupyterlab/testutils';

const server = new JupyterServer();

beforeAll(async () => {
  await server.start();
});

afterAll(async () => {
  await server.shutdown();
});

describe('@jupyterlab/apputils', () => {
  let widget: Toolbar<Widget>;

  beforeEach(async () => {
    jest.setTimeout(20000);
    widget = new Toolbar();
  });

  afterEach(async () => {
    widget.dispose();
  });

  describe('Toolbar', () => {
    describe('#constructor()', () => {
      it('should construct a new toolbar widget', () => {
        const widget = new Toolbar();
        expect(widget).toBeInstanceOf(Toolbar);
      });

      it('should add the `jp-Toolbar` class', () => {
        const widget = new Toolbar();
        expect(widget.hasClass('jp-Toolbar')).toBe(true);
      });
    });

    describe('#names()', () => {
      it('should get an ordered list the toolbar item names', () => {
        widget.addItem('foo', new Widget());
        widget.addItem('bar', new Widget());
        widget.addItem('baz', new Widget());
        expect(toArray(widget.names())).toEqual(['foo', 'bar', 'baz']);
      });
    });

    describe('#addItem()', () => {
      it('should add an item to the toolbar', () => {
        const item = new Widget();
        expect(widget.addItem('test', item)).toBe(true);
        expect(toArray(widget.names())).toContain('test');
      });

      it('should add the `jp-Toolbar-item` class to the widget', () => {
        const item = new Widget();
        widget.addItem('test', item);
        expect(item.hasClass('jp-Toolbar-item')).toBe(true);
      });

      it('should return false if the name is already used', () => {
        widget.addItem('test', new Widget());
        expect(widget.addItem('test', new Widget())).toBe(false);
      });
    });

    describe('#insertItem()', () => {
      it('should insert the item into the toolbar', () => {
        widget.addItem('a', new Widget());
        widget.addItem('b', new Widget());
        widget.insertItem(1, 'c', new Widget());
        expect(toArray(widget.names())).toEqual(['a', 'c', 'b']);
      });

      it('should clamp the bounds', () => {
        widget.addItem('a', new Widget());
        widget.addItem('b', new Widget());
        widget.insertItem(10, 'c', new Widget());
        expect(toArray(widget.names())).toEqual(['a', 'b', 'c']);
      });
    });

    describe('#insertAfter()', () => {
      it('should insert an item into the toolbar after `c`', () => {
        widget.addItem('a', new Widget());
        widget.addItem('b', new Widget());
        widget.insertItem(1, 'c', new Widget());
        widget.insertAfter('c', 'd', new Widget());
        expect(toArray(widget.names())).toEqual(['a', 'c', 'd', 'b']);
      });

      it('should return false if the target item does not exist', () => {
        widget.addItem('a', new Widget());
        widget.addItem('b', new Widget());
        const value = widget.insertAfter('c', 'd', new Widget());
        expect(value).toBe(false);
      });
    });

    describe('#insertBefore()', () => {
      it('should insert an item into the toolbar before `c`', () => {
        widget.addItem('a', new Widget());
        widget.addItem('b', new Widget());
        widget.insertItem(1, 'c', new Widget());
        widget.insertBefore('c', 'd', new Widget());
        expect(toArray(widget.names())).toEqual(['a', 'd', 'c', 'b']);
      });

      it('should return false if the target item does not exist', () => {
        widget.addItem('a', new Widget());
        widget.addItem('b', new Widget());
        const value = widget.insertBefore('c', 'd', new Widget());
        expect(value).toBe(false);
      });
    });

    describe('.createFromCommand', () => {
      const commands = new CommandRegistry();
      const testLogCommandId = 'test:toolbar-log';
      const logArgs: ReadonlyPartialJSONObject[] = [];
      let enabled = false;
      let toggled = true;
      let visible = false;
      commands.addCommand(testLogCommandId, {
        execute: args => {
          logArgs.push(args);
        },
        label: 'Test log command label',
        caption: 'Test log command caption',
        usage: 'Test log command usage',
        iconClass: 'test-icon-class',
        className: 'test-log-class',
        isEnabled: () => enabled,
        isToggled: () => toggled,
        isVisible: () => visible
      });

      async function render(button: CommandToolbarButton) {
        button.update();
        await framePromise();
        expect(button.renderPromise).toBeDefined();
        await button.renderPromise;
      }

      it('should create a button', () => {
        const button = new CommandToolbarButton({
          commands,
          id: testLogCommandId
        });
        expect(button).toBeInstanceOf(CommandToolbarButton);
        button.dispose();
      });

      it('should add main class', async () => {
        const button = new CommandToolbarButton({
          commands,
          id: testLogCommandId
        });
        await render(button);
        const buttonNode = button.node.firstChild as HTMLButtonElement;
        expect(buttonNode.classList.contains('test-log-class')).toBe(true);
        button.dispose();
      });

      it('should add an icon with icon class and label', async () => {
        const button = new CommandToolbarButton({
          commands,
          id: testLogCommandId
        });
        await render(button);
        const buttonNode = button.node.firstChild as HTMLButtonElement;
        expect(buttonNode.title).toBe('Test log command caption');
        const wrapperNode = buttonNode.firstChild as HTMLElement;
        const iconNode = wrapperNode.firstChild as HTMLElement;
        expect(iconNode.classList.contains('test-icon-class')).toBe(true);
        button.dispose();
      });

      it('should apply state classes', async () => {
        enabled = false;
        toggled = true;
        visible = false;
        const button = new CommandToolbarButton({
          commands,
          id: testLogCommandId
        });
        await render(button);
        const buttonNode = button.node.firstChild as HTMLButtonElement;
        expect(buttonNode.disabled).toBe(true);
        expect(buttonNode.classList.contains('lm-mod-toggled')).toBe(true);
        expect(buttonNode.classList.contains('lm-mod-hidden')).toBe(true);
        button.dispose();
      });

      it('should update state classes', async () => {
        enabled = false;
        toggled = true;
        visible = false;
        const button = new CommandToolbarButton({
          commands,
          id: testLogCommandId
        });
        await render(button);
        const buttonNode = button.node.firstChild as HTMLButtonElement;
        expect(buttonNode.disabled).toBe(true);
        expect(buttonNode.classList.contains('lm-mod-toggled')).toBe(true);
        expect(buttonNode.classList.contains('lm-mod-hidden')).toBe(true);
        enabled = true;
        visible = true;
        commands.notifyCommandChanged(testLogCommandId);
        expect(buttonNode.disabled).toBe(false);
        expect(buttonNode.classList.contains('lm-mod-toggled')).toBe(true);
        expect(buttonNode.classList.contains('lm-mod-hidden')).toBe(false);
        enabled = false;
        visible = false;
        button.dispose();
      });

      it('should use the command label if no icon class/label', async () => {
        const id = 'to-be-removed';
        const cmd = commands.addCommand(id, {
          execute: () => {
            return;
          },
          label: 'Label-only button'
        });
        const button = new CommandToolbarButton({
          commands,
          id
        });
        await render(button);
        const buttonNode = button.node.firstChild as HTMLButtonElement;
        expect(buttonNode.textContent).toBe('Label-only button');
        cmd.dispose();
      });

      it('should update the node content on command change event', async () => {
        const id = 'to-be-removed';
        let iconClassValue: string = '';
        const cmd = commands.addCommand(id, {
          execute: () => {
            /* no op */
          },
          label: 'Label-only button',
          iconClass: () => iconClassValue ?? ''
        });
        const button = new CommandToolbarButton({
          commands,
          id
        });
        await render(button);
        const buttonNode = button.node.firstChild as HTMLButtonElement;
        expect(buttonNode.textContent).toBe('Label-only button');
        expect(buttonNode.classList.contains(iconClassValue)).toBe(false);

        iconClassValue = 'updated-icon-class';
        commands.notifyCommandChanged(id);
        await render(button);
        const wrapperNode = buttonNode.firstChild as HTMLElement;
        const iconNode = wrapperNode.firstChild as HTMLElement;
        expect(iconNode.classList.contains(iconClassValue)).toBe(true);
        cmd.dispose();
      });
    });

    describe('Kernel buttons', () => {
      let sessionContext: SessionContext;
      beforeEach(async () => {
        sessionContext = await createSessionContext();
      });

      afterEach(async () => {
        await sessionContext.shutdown();
        sessionContext.dispose();
      });

      describe('.createInterruptButton()', () => {
        it("should add an inline svg node with the 'stop' icon", async () => {
          const button = Toolbar.createInterruptButton(sessionContext);
          Widget.attach(button, document.body);
          await framePromise();
          expect(
            button.node.querySelector("[data-icon$='stop']")
          ).toBeDefined();
        });
      });

      describe('.createRestartButton()', () => {
        it("should add an inline svg node with the 'refresh' icon", async () => {
          const button = Toolbar.createRestartButton(sessionContext);
          Widget.attach(button, document.body);
          await framePromise();
          expect(
            button.node.querySelector("[data-icon$='refresh']")
          ).toBeDefined();
        });
      });

      describe('.createKernelNameItem()', () => {
        it("should display the `'display_name'` of the kernel", async () => {
          const item = Toolbar.createKernelNameItem(sessionContext);
          await sessionContext.initialize();
          Widget.attach(item, document.body);
          await framePromise();
          const node = item.node.querySelector(
            '.jp-ToolbarButtonComponent-label'
          )!;
          expect(node.textContent).toBe(sessionContext.kernelDisplayName);
        });
      });

      describe('.createKernelStatusItem()', () => {
        beforeEach(async () => {
          await sessionContext.initialize();
          await sessionContext.session?.kernel?.info;
        });

        it('should display a busy status if the kernel status is busy', async () => {
          const item = Toolbar.createKernelStatusItem(sessionContext);
          let called = false;
          sessionContext.statusChanged.connect((_, status) => {
            if (status === 'busy') {
              expect(
                item.node.querySelector("[data-icon$='circle']")
              ).toBeDefined();
              called = true;
            }
          });
          const future = sessionContext.session?.kernel?.requestExecute({
            code: 'a = 109\na'
          })!;
          await future.done;
          expect(called).toBe(true);
        });

        it('should show the current status in the node title', async () => {
          const item = Toolbar.createKernelStatusItem(sessionContext);
          const status = sessionContext.session?.kernel?.status;
          expect(item.node.title.toLowerCase()).toContain(status);
          let called = false;
          const future = sessionContext.session?.kernel?.requestExecute({
            code: 'a = 1'
          })!;
          future.onIOPub = msg => {
            if (sessionContext.session?.kernel?.status === 'busy') {
              expect(item.node.title.toLowerCase()).toContain('busy');
              called = true;
            }
          };
          await future.done;
          expect(called).toBe(true);
        });

        it('should handle a starting session', async () => {
          await sessionContext.session?.kernel?.info;
          await sessionContext.shutdown();
          sessionContext = await createSessionContext();
          await sessionContext.initialize();
          const item = Toolbar.createKernelStatusItem(sessionContext);
          expect(item.node.title).toBe('Kernel Connecting');
          expect(
            item.node.querySelector("[data-icon$='circle-empty']")
          ).toBeDefined();
          await sessionContext.initialize();
          await sessionContext.session?.kernel?.info;
        });
      });
    });
  });

  describe('ToolbarButton', () => {
    describe('#constructor()', () => {
      it('should accept no arguments', () => {
        const widget = new ToolbarButton();
        expect(widget).toBeInstanceOf(ToolbarButton);
      });

      it('should accept options', async () => {
        const widget = new ToolbarButton({
          className: 'foo',
          iconClass: 'iconFoo',
          onClick: () => {
            return void 0;
          },
          tooltip: 'bar'
        });
        Widget.attach(widget, document.body);
        await framePromise();
        const button = widget.node.firstChild as HTMLElement;
        expect(button.classList.contains('foo')).toBe(true);
        expect(button.querySelector('.iconFoo')).toBeDefined();
        expect(button.title).toBe('bar');
      });
    });

    describe('#dispose()', () => {
      it('should dispose of the resources used by the widget', () => {
        const button = new ToolbarButton();
        button.dispose();
        expect(button.isDisposed).toBe(true);
      });

      it('should be safe to call more than once', () => {
        const button = new ToolbarButton();
        button.dispose();
        button.dispose();
        expect(button.isDisposed).toBe(true);
      });
    });

    describe('#handleEvent()', () => {
      describe('click', () => {
        it('should activate the callback', async () => {
          let called = false;
          const button = new ToolbarButton({
            onClick: () => {
              called = true;
            }
          });
          Widget.attach(button, document.body);
          await framePromise();
          simulate(button.node.firstChild as HTMLElement, 'mousedown');
          expect(called).toBe(true);
          button.dispose();
        });
      });
      describe('keydown', () => {
        it('Enter should activate the callback', async () => {
          let called = false;
          const button = new ToolbarButton({
            onClick: () => {
              called = true;
            }
          });
          Widget.attach(button, document.body);
          await framePromise();
          simulate(button.node.firstChild as HTMLElement, 'keydown', {
            key: 'Enter'
          });
          expect(called).toBe(true);
          button.dispose();
        });
        it('Space should activate the callback', async () => {
          let called = false;
          const button = new ToolbarButton({
            onClick: () => {
              called = true;
            }
          });
          Widget.attach(button, document.body);
          await framePromise();
          simulate(button.node.firstChild as HTMLElement, 'keydown', {
            key: ' '
          });
          expect(called).toBe(true);
          button.dispose();
        });
      });
    });

    //   describe('#onAfterAttach()', () => {
    //     it('should add event listeners to the node', () => {
    //       const button = new LogToolbarButton();
    //       Widget.attach(button, document.body);
    //       expect(button.methods).to.contain('onAfterAttach');
    //       simulate(button.node, 'click');
    //       expect(button.events).to.contain('click');
    //       button.dispose();
    //     });
    //   });

    //   describe('#onBeforeDetach()', () => {
    //     it('should remove event listeners from the node', async () => {
    //       const button = new LogToolbarButton();
    //       Widget.attach(button, document.body);
    //       await framePromise();
    //       Widget.detach(button);
    //       expect(button.methods).to.contain('onBeforeDetach');
    //       simulate(button.node, 'click');
    //       expect(button.events).to.not.contain('click');
    //       button.dispose();
    //     });
    //   });
  });
});
