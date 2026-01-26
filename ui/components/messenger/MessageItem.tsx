'use client';
import { useState, useRef } from 'react';
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
    <div className={`flex gap-2 ${isOwn ? 'justify-end' : 'justify-start'} group hover:bg-neutral-800/5 rounded-lg p-1 transition-colors relative`}>
      {!isOwn && (
        <Avatar size="sm" className="bg-default text-default-foreground mt-1">
          <Avatar.Fallback>
            {message.senderName.slice(0, 2).toUpperCase()}
          </Avatar.Fallback>
        </Avatar>
      )}

      <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} max-w-[80%]`}>
        {!isOwn && (
          <p className="text-xs text-muted mb-1 px-1">{message.senderName}</p>
        )}

        <div
          className={`flex items-start gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}
          onContextMenu={handleContextMenu}
        >
          <Card
            className={`px-4 py-2 ${isOwn
              ? 'bg-accent text-accent-foreground'
              : 'bg-surface text-surface-foreground border border-border'
              } cursor-default`}
          >
            <p className="text-sm break-words whitespace-pre-wrap">{message.content}</p>
          </Card>

          {/* Context Menu Dropdown */}
          <div className="fixed w-0 h-0" style={{ left: position.x, top: position.y }}>
            <Dropdown isOpen={isOpen} onOpenChange={setIsOpen}>
              <Dropdown.Trigger>
                {/* Invisible trigger for positioning */}
                <button className="w-0 h-0 opacity-0 outline-none" />
              </Dropdown.Trigger>
              <Dropdown.Popover placement="bottom start" offset={0}>
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
          </div>
        </div>

        <div className="flex items-center gap-1 mt-1 px-1">
          <p className="text-xs text-muted">{message.timestamp}</p>
          {isOwn && message.status && (
            <>
              {message.status === 'sending' && (
                <Clock className="w-3 h-3 text-muted" />
              )}
              {message.status === 'sent' && (
                <Check className="w-3 h-3 text-muted" />
              )}
              {message.status === 'read' && (
                <CheckDouble className="w-3 h-3 text-muted" />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}