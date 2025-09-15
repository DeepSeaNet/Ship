import React, { useRef, useEffect } from 'react'
import { LogEntry } from '../types/mediasoup'

interface LogDisplayProps {
  logs: LogEntry[]
  showLogs: boolean
  onToggleShowLogs: () => void
  onClearLogs: () => void
}

const LogDisplay: React.FC<LogDisplayProps> = ({
  logs,
  showLogs,
  onToggleShowLogs,
  onClearLogs,
}) => {
  const logsContainerRef = useRef<HTMLDivElement>(null)

  // Прокрутка к последнему сообщению при добавлении нового
  useEffect(() => {
    if (showLogs && logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight
    }
  }, [logs, showLogs])

  // Форматирование метки времени
  const formatTimestamp = (date: Date): string => {
    return new Intl.DateTimeFormat('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(date)
  }

  return (
    <div className="logs-panel">
      <div className="logs-header">
        <h3>Журнал системы</h3>
        <div className="logs-controls">
          <button onClick={onToggleShowLogs}>
            {showLogs ? 'Скрыть' : 'Показать'}
          </button>
          <button onClick={onClearLogs}>Очистить</button>
        </div>
      </div>
      {showLogs && (
        <div className="logs-container" ref={logsContainerRef}>
          {logs.length === 0 ? (
            <div className="log-entry log-info">
              <span className="log-timestamp">
                {formatTimestamp(new Date())}
              </span>
              <span className="log-message">Журнал пуст</span>
            </div>
          ) : (
            logs.map((log, index) => (
              <div key={index} className={`log-entry log-${log.type}`}>
                <span className="log-timestamp">
                  {formatTimestamp(log.timestamp)}
                </span>
                <span className="log-message">{log.message}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export default LogDisplay
