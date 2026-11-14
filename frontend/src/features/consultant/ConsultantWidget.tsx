import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import type { ChatMessageOut } from '@passport/contracts';
import { fetchChatHistory, sendChatMessage } from './chatApi';
import './ConsultantWidget.css';

export interface ConsultantWidgetProps {
  activeSectionId?: number;
  userId?: string;
}

const QUICK_PROMPTS = [
  'Какие лимиты в смете 8-й очереди?',
  'Как описать 2 аналога в Блоке 6?',
  'Помоги сформулировать текущий блок по правилам ФСИ',
];

export function ConsultantWidget({ activeSectionId, userId }: ConsultantWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessageOut[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const feedEndRef = useRef<HTMLDivElement | null>(null);

  // При первом открытии диалога загружаем историю диалога
  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;
    setIsLoadingHistory(true);

    fetchChatHistory(userId)
      .then((res) => {
        if (mounted && res && Array.isArray(res.messages)) {
          setMessages(res.messages);
        }
      })
      .catch(() => {
        // Ошибка перехватывается тихо без console.error (для тестов и автономного режима)
      })
      .finally(() => {
        if (mounted) {
          setIsLoadingHistory(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [isOpen, userId]);

  // Скролл вниз при обновлении сообщений
  useEffect(() => {
    if (isOpen && feedEndRef.current) {
      feedEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isSending]);

  const handleCopy = async (id: string, text: string) => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      }
    } catch {
      // Игнорируем ошибку буфера обмена в тестах
    }
    setCopiedId(id);
    setTimeout(() => {
      setCopiedId((curr) => (curr === id ? null : curr));
    }, 2000);
  };

  const handleSend = async (textToSend: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed || isSending) return;

    setIsSending(true);
    setError(null);
    setInputText('');

    // Оптимистичное добавление пользовательского сообщения
    const tempUserMsg: ChatMessageOut = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: trimmed,
      referenced_cards: [],
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const resp = await sendChatMessage({
        userId,
        message: trimmed,
        activeSectionId,
      });

      if (resp && resp.history && resp.history.length > 0) {
        setMessages(resp.history);
      } else if (resp && resp.assistant_message) {
        setMessages((prev) => {
          const withoutTemp = prev.filter((m) => m.id !== tempUserMsg.id);
          return [...withoutTemp, resp.user_message ?? tempUserMsg, resp.assistant_message];
        });
      }
    } catch (err: any) {
      setError('Не удалось получить ответ консультанта. Попробуйте ещё раз.');
    } finally {
      setIsSending(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    handleSend(inputText);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(inputText);
    }
  };

  // Важно для существующих тестов: пока isOpen = false, рендерится только кнопка вызова,
  // нет сетевых вызовов и нет полей textbox в DOM
  if (!isOpen) {
    return (
      <button
        type="button"
        className="consultant-trigger"
        aria-label="Открыть чат с ИИ-Консультантом"
        onClick={() => setIsOpen(true)}
      >
        <span className="consultant-trigger__icon" aria-hidden="true">💡</span>
        <span className="consultant-trigger__label">ИИ-Консультант</span>
      </button>
    );
  }

  return (
    <div className="consultant-overlay" onClick={() => setIsOpen(false)}>
      <div
        className="consultant-drawer"
        role="dialog"
        aria-label="ИИ-Консультант по гранту ФСИ"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Шапка панели */}
        <header className="consultant-header">
          <div className="consultant-header__top">
            <h2 className="consultant-title">ИИ-Консультант ФСИ</h2>
            <button
              type="button"
              className="consultant-close"
              aria-label="Закрыть консультант"
              onClick={() => setIsOpen(false)}
            >
              ✕ Закрыть консультант
            </button>
          </div>
          <div>
            <span className="consultant-badge">Режим советчика — не меняет поля автоматически</span>
          </div>
        </header>

        {/* Быстрые подсказки */}
        <div className="consultant-chips">
          {QUICK_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              className="consultant-chip"
              disabled={isSending}
              onClick={() => handleSend(prompt)}
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Лента сообщений */}
        <div className="consultant-feed" role="log" aria-live="polite">
          {messages.length === 0 && !isLoadingHistory && (
            <div className="consultant-welcome">
              <p>
                <strong>Здравствуйте!</strong> Я экспертный ИИ-Консультант грантового конкурса «Студенческий стартап» (очередь 8).
              </p>
              <p>
                Помогу разобраться в правилах, разъясню замечания аудитора и предложу готовые черновики формулировок, которые вы сможете скопировать в заявку.
              </p>
            </div>
          )}

          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                className={`consultant-msg consultant-msg--${msg.role}`}
              >
                <div className="consultant-msg__bubble">
                  <div className="consultant-msg__text">{msg.content}</div>

                  {!isUser && (
                    <div className="consultant-msg__actions">
                      <button
                        type="button"
                        className="consultant-btn-copy"
                        onClick={() => handleCopy(msg.id, msg.content)}
                      >
                        {copiedId === msg.id ? 'Скопировано ✓' : 'Скопировать'}
                      </button>
                    </div>
                  )}

                  {!isUser && msg.referenced_cards && msg.referenced_cards.length > 0 && (
                    <div className="consultant-msg__sources">
                      Источники RAG: {msg.referenced_cards.join(', ')}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {isSending && (
            <div className="consultant-typing">
              <span>Консультант формулирует ответ</span>
              <span className="consultant-typing__dot" />
              <span className="consultant-typing__dot" />
              <span className="consultant-typing__dot" />
            </div>
          )}

          <div ref={feedEndRef} />
        </div>

        {/* Форма ввода вопроса внизу */}
        <form className="consultant-form" onSubmit={onSubmit}>
          {error && <div className="consultant-error">{error}</div>}
          <textarea
            className="consultant-textarea"
            aria-label="Вопрос ИИ-Консультанту"
            placeholder="Спросите по правилам ФСИ или попросите черновик текста для блока..."
            rows={3}
            value={inputText}
            onChange={(e) => {
              setInputText(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={onKeyDown}
            disabled={isSending}
          />
          <div className="consultant-form__footer">
            <button
              type="submit"
              className="consultant-btn-submit"
              disabled={isSending || !inputText.trim()}
            >
              {isSending ? 'Отправка...' : 'Отправить в чат'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
