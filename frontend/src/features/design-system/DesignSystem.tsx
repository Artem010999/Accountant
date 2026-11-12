import { useEffect } from 'react';
import { Button, Card, ClaimMark, Logo, StatusPill, TextField, TextLink, type ClaimKind } from '../../shared/ui';
import './DesignSystem.css';

// Служебная страница: DesignSystem.dc.html 1-в-1 средствами нашего кита. Тексты — дословно из эталона.

const BRAND_SWATCHES = [
  { name: 'Оранжевый', fill: 'var(--color-brand)', code: '#FF6B1A', note: 'Главные кнопки, бренд. Текст на нём — только тёмный.' },
  { name: 'Терракота', fill: 'var(--color-terracotta)', code: '#7C2D12 · вложенный #9A3412', note: 'Тёмные акцентные блоки вместо синих. Текст белый и #FED7AA.' },
  { name: 'Персик', fill: 'var(--color-peach)', code: '#FFF1E8 · #FFFAF6', note: 'Подложки, активный пункт меню, выбранная карточка.' },
  { name: 'Оранжевый текст', fill: 'var(--color-link)', code: '#C2410C · крупный #E8590C', note: 'Ссылки и подписи на белом — проходит контраст 5:1.' },
];

const NEUTRAL_SWATCHES = [
  { fill: 'var(--color-ink)', code: '#17171C текст', bordered: false },
  { fill: 'var(--color-gray-800)', code: '#3F3F46', bordered: false },
  { fill: 'var(--color-gray-600)', code: '#52525B вторичный', bordered: false },
  { fill: 'var(--color-gray-500)', code: '#71717A подписи', bordered: false },
  { fill: 'var(--color-gray-200)', code: '#E4E4E7 линии', bordered: false },
  { fill: 'var(--color-gray-100)', code: '#F4F4F5 карточки', bordered: false },
  { fill: 'var(--color-gray-50)', code: '#FAFAFA фон меню', bordered: true },
];

const CLAIMS: { kind: ClaimKind; sample: string; title: string; note: string }[] = [
  { kind: 'fact-doc', sample: 'выручка 10 000 ₽', title: 'Факт с документом', note: 'Цитата найдена в файле. Сплошная зелёная.' },
  { kind: 'fact-no-doc', sample: 'две фокус-группы', title: 'Факт без документа', note: 'Риск. Пунктир янтарный. Попадает в предупреждения.' },
  { kind: 'plan', sample: 'три пилота в 2027', title: 'План', note: 'Будущее. Точки синие. Никогда не достижение.' },
  { kind: 'hypothesis', sample: 'пользователю трудно', title: 'Гипотеза', note: 'Предположение о проблеме или рынке.' },
  { kind: 'hearsay', sample: 'статус Сколково', title: 'Со слов команды', note: 'Сообщение без документа. Серый пунктир.' },
  { kind: 'lost', sample: 'по 25 участников', title: 'Потеряна привязка', note: 'После правки текста. Красный, зачёркнуто, блок «Нужна проверка».' },
];

export function DesignSystem() {
  useEffect(() => {
    document.title = 'Буха — дизайн-система';
  }, []);

  return (
    <div className="ds">
      <main className="ds__main">
        <section className="ds__hero">
          <Logo variant="hero" />
          <div className="ds__hero-text">
            <h1 className="t-screen-title ds__h1">Дизайн-система</h1>
            <p className="t-lead ds__lead">Совёнок-бухгалтер: внимательный, дотошный, но дружелюбный. Много воздуха, крупные заголовки, скруглённые карточки, один яркий акцент.</p>
          </div>
        </section>

        <section className="ds__section">
          <h2 className="t-section-title ds__h2">Цвета бренда</h2>
          <div className="ds__swatches">
            {BRAND_SWATCHES.map((s) => (
              <div className="ds__swatch-card" key={s.name}>
                <div className="ds__swatch-fill" style={{ background: s.fill }} />
                <div className="ds__swatch-text">
                  <b className="ds__swatch-name">{s.name}</b>
                  <code className="ds__meta14">{s.code}</code>
                  <span className="ds__meta14">{s.note}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="ds__chips">
            {NEUTRAL_SWATCHES.map((s) => (
              <div className="ds__chip" key={s.code}>
                <div
                  className={s.bordered ? 'ds__chip-fill ds__chip-fill--bordered' : 'ds__chip-fill'}
                  style={{ background: s.fill }}
                />
                <code className="ds__code13">{s.code}</code>
              </div>
            ))}
          </div>
        </section>

        <section className="ds__section">
          <h2 className="t-section-title ds__h2">Язык утверждений</h2>
          <p className="ds__p16">Главное, что ищет эксперт фонда, — где доказательство. Поэтому самые заметные метки у рисков: факт без документа и слова команды. Тип различается и цветом, и стилем линии — чтобы читалось без цвета.</p>
          <div className="ds__claims">
            {CLAIMS.map((c) => (
              <Card variant="outline" key={c.kind}>
                <span className="ds__claim-sample">
                  <ClaimMark kind={c.kind}>{c.sample}</ClaimMark>
                </span>
                <b className="ds__claim-title">{c.title}</b>
                <span className="ds__meta14">{c.note}</span>
              </Card>
            ))}
          </div>
          <div className="ds__row">
            <span className="ds__row-label">Статус поля:</span>
            <span className="ds__caption14">без метки — черновик ИИ</span>
            <StatusPill tone="warning">Нужна проверка</StatusPill>
            <StatusPill tone="info">Подтверждено</StatusPill>
            <StatusPill tone="success">Согласовано</StatusPill>
          </div>
          <div className="ds__row">
            <span className="ds__row-label">Допуск:</span>
            <StatusPill tone="success">Можно готовить заявку</StatusPill>
            <StatusPill tone="warning">Нужно уточнить</StatusPill>
            <StatusPill tone="danger">Есть стоп-факторы</StatusPill>
          </div>
        </section>

        <section className="ds__section">
          <h2 className="t-section-title ds__h2">Типографика · Onest</h2>
          <div className="ds__type-card">
            <div className="ds__type-row">
              <code className="ds__type-meta">68 / 800</code>
              <span className="t-display">Паспорт</span>
            </div>
            <div className="ds__type-row">
              <code className="ds__type-meta">52 / 800</code>
              <span className="t-title">Как это работает</span>
            </div>
            <div className="ds__type-row">
              <code className="ds__type-meta">40 / 800</code>
              <span className="t-screen-title">Заголовок экрана</span>
            </div>
            <div className="ds__type-row">
              <code className="ds__type-meta">26 / 700</code>
              <span className="t-card-title">Заголовок карточки</span>
            </div>
            <div className="ds__type-row">
              <code className="ds__type-meta">17 / 400</code>
              <span className="t-body">Основной текст интерфейса и полей паспорта</span>
            </div>
            <div className="ds__type-row">
              <code className="ds__type-meta">14 / 500</code>
              <span className="t-label ds__label-color">Подписи, мета, статусы</span>
            </div>
          </div>
        </section>

        <section className="ds__section">
          <h2 className="t-section-title ds__h2">Кнопки и формы</h2>
          <div className="ds__row ds__row--buttons">
            <Button variant="primary">Главное действие</Button>
            <Button variant="secondary">Второстепенное</Button>
            <Button variant="inverse">На оранжевом фоне</Button>
            <Button variant="outline">Малая</Button>
            <TextLink href="#">Текстовая ссылка</TextLink>
          </div>
          <div className="ds__fields">
            <TextField label="Поле ввода" defaultValue="Иванов Иван Иванович" />
            <TextField label="В фокусе" state="focus" defaultValue="Фокус — персиковое кольцо" />
          </div>
        </section>

        <section className="ds__cards">
          <Card variant="muted">
            <h3 className="t-h3 ds__h3">Скругления</h3>
            <p className="ds__body15">Кнопки и чипы — полные (999). Большие карточки — 28–40. Карточки в кабинете — 22–24. Поля ввода — 16. Мелкие элементы — 12.</p>
          </Card>
          <Card variant="muted">
            <h3 className="t-h3 ds__h3">Правила цвета</h3>
            <p className="ds__body15">Оранжевый — только бренд и главное действие, не для предупреждений. Белый текст на оранжевом не используем: контраст 2,9:1. Предупреждения — янтарные, ошибки — красные. Тёмный блок — терракота.</p>
          </Card>
          <Card variant="dark">
            <h3 className="t-h3 ds__h3">Тон текста</h3>
            <p className="ds__body15 ds__body15--peach">Коротко, на «вы», без канцелярита. Говорим, что случилось и что сделать дальше. Не обещаем победу и не пишем того, чего нет в материалах.</p>
          </Card>
        </section>
      </main>
    </div>
  );
}
