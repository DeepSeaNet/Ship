'use client';
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Card, Avatar, Dropdown, Kbd, Label } from '@heroui/react';
import { CheckDouble, Clock, Check } from '@gravity-ui/icons';
import { Message } from '@/hooks/messengerTypes';
import { useMessageActions } from '@/hooks/useMessageActions';

interface MessageItemProps {
  message: Message;
}

export function MessageItem({ message }: MessageItemProps) {
  const isOwn = message.isOwn;
  const { actions, handleAction } = useMessageActions(message);
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setPosition({ x: e.clientX, y: e.clientY });
    setIsOpen(true);
  };

  return (
    <>
      <div
        className={`flex gap-2 ${isOwn ? 'justify-end' : 'justify-start'} group hover:bg-neutral-800/5 rounded-lg p-1 transition-colors relative animate-in fade-in zoom-in-95 duration-500 ${isOwn ? 'slide-in-from-right-8' : 'slide-in-from-left-8'} fill-mode-both`}
        style={{
          animationDelay: `40ms`
        }}
      >
        {!isOwn && (
          <Avatar size="sm" className="bg-default text-default-foreground mt-1">
            <Avatar.Fallback>
              {message.senderName?.slice(0, 2).toUpperCase() || '??'}
            </Avatar.Fallback>
          </Avatar>
        )}

        <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} max-w-[80%]`}>
          {!isOwn && (
            <p className="text-xs text-muted mb-1 px-1">{message.senderName || 'User ' + message.senderId}</p>
          )}

          <div
            className={`flex items-start gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}
            onContextMenu={handleContextMenu}
          >
            <Card
              className={`px-3 py-1.5 ${isOwn
                ? 'bg-accent text-accent-foreground'
                : 'bg-surface text-surface-foreground border border-border'
                } cursor-default min-w-[60px] max-w-full`}
            >
              <div className="flex flex-wrap items-end justify-end gap-x-2 gap-y-1">
                <p className="text-sm break-all whitespace-pre-wrap flex-1 min-w-[10px]">
                  {message.content}
                </p>
                <div className={`flex items-center gap-1 shrink-0 mb-[-2px] ${isOwn ? 'ml-auto' : ''}`}>
                  <span className="text-[10px] opacity-60 font-medium">
                    {message.timestamp}
                  </span>
                  {isOwn && message.status && (
                    <div className="flex items-center opacity-60">
                      {message.status === 'sending' && (
                        <Clock className="w-3.5 h-3.5" />
                      )}
                      {message.status === 'sent' && (
                        <Check className="w-3.5 h-3.5" />
                      )}
                      {message.status === 'read' && (
                        <CheckDouble className="w-3.5 h-3.5" />
                      )}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Context Menu Dropdown - Portaled to body to avoid transform-induced positioning bugs */}
      {typeof document !== 'undefined' && createPortal(
        <div className="fixed w-0 h-0 p-0 m-0 overflow-visible pointer-events-none" style={{ left: position.x, top: position.y, zIndex: 9999 }}>
          <Dropdown isOpen={isOpen} onOpenChange={setIsOpen}>
            <Dropdown.Trigger>
              <div className="w-0 h-0 opacity-0 outline-none p-0 m-0 border-none pointer-events-auto" />
            </Dropdown.Trigger>
            <Dropdown.Popover placement="bottom start" offset={2} className="min-w-[160px]">
              <Dropdown.Menu
                aria-label="Message actions"
                onAction={(key) => handleAction(key)}
              >
                {actions.map((action) => (
                  <Dropdown.Item
                    key={action.id}
                    id={action.id}
                    textValue={action.label}
                    className={action.intent === 'danger' ? 'text-danger' : ''}
                  >
                    {action.icon}
                    <Label>{action.label}</Label>
                    {action.shortcut && (
                      <Kbd className="ms-auto" slot="keyboard" variant="light">
                        <Kbd.Content>{action.shortcut}</Kbd.Content>
                      </Kbd>
                    )}
                  </Dropdown.Item>
                ))}
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
        </div>,
        document.body
      )}
    </>
  );
}