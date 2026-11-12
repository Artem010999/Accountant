import { useState, type ReactNode } from 'react';
import { PillLink, SegmentedControl } from '../../shared/ui';
import { SiteLayout } from '../../shared/layout/SiteLayout';
import './Pricing.css';

// Тарифы: design/project/Pricing.dc.html. Тексты дословно из эталона; без подвала, как в эталоне.

type Period = 'first' | 'renew';

const PERIOD_OPTIONS = [
  { id: 'first', label: 'Первая оплата' },
  { id: 'renew', label: 'Продление' },
];

// Строки таблицы сравнения: значение для Базового, Профессионального и Премиума. "off" — серое «Нет» или «—».
interface Cell {
  text: string;
  off?: boolean;
}
const YES: Cell = { text: 'Да' };
const NO: Cell = { text: 'Нет', off: true };

const COMPARISON: { feature: string; base: Cell; pro: Cell; premium: Cell }[] = [
  { feature: 'Паспорт по 10 блокам и разметка утверждений', base: YES, pro: YES, premium: YES },
  { feature: 'Анкета и вопросы по пробелам с примерами', base: YES, pro: YES, premium: YES },
  { feature: 'Стоп-факторы, статус допуска и чек-лист', base: YES, pro: YES, premium: YES },
  { feature: 'Экспорт в DOCX и PDF', base: YES, pro: YES, premium: YES },
  { feature: 'Разбор документов ИИ (PDF, DOCX, PPTX, сканы)', base: NO, pro: YES, premium: YES },
  { feature: 'Файлов в проекте', base: { text: '0' }, pro: { text: '10' }, premium: { text: '50' } },
  { feature: 'Проверка научно-технической новизны', base: NO, pro: YES, premium: YES },
  { feature: 'Консультант', base: NO, pro: NO, premium: YES },
  { feature: 'Скидка при продлении', base: { text: '—', off: true }, pro: { text: '15%' }, premium: { text: '10%' } },
];

function Check({ off = false }: { off?: boolean }) {
  return off ? (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="pricing__icon pricing__icon--off">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  ) : (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="pricing__icon">
      <path d="M5 12l5 5 9-10" />
    </svg>
  );
}

function Item({ children, off = false }: { children: ReactNode; off?: boolean }) {
  return (
    <li className={off ? 'pricing__item pricing__item--off' : 'pricing__item'}>
      <Check off={off} />
      {children}
    </li>
  );
}

export function Pricing() {
  const [period, setPeriod] = useState<Period>('first');
  const renew = period === 'renew';

  const proPrice = renew ? '841 ₽' : '990 ₽';
  const premPrice = renew ? '4 491 ₽' : '4 990 ₽';

  return (
    <SiteLayout withFooter={false}>
      <section className="pricing__intro">
        <h1 className="pricing__title">Тарифы и цены</h1>
        <p className="pricing__lead">Начните бесплатно. Платный доступ нужен, чтобы Буха разобрала ваши документы и проверила новизну.</p>
        <div className="pricing__toggle">
          <SegmentedControl
            mode="buttons"
            ariaLabel="Период оплаты"
            options={PERIOD_OPTIONS}
            value={period}
            onChange={(id) => setPeriod(id as Period)}
          />
        </div>
      </section>

      <section className="pricing__cards">
        <div className="pricing__card">
          <div className="pricing__head">
            <h2 className="pricing__name">Базовый</h2>
            <p className="pricing__desc">Чтобы описать идею и увидеть, чего не хватает</p>
          </div>
          <p className="pricing__price">0 ₽</p>
          <ul className="pricing__list">
            <Item>Паспорт по 10 блокам</Item>
            <Item>Анкета и вопросы по пробелам</Item>
            <Item>Проверка стоп-факторов и чек-лист</Item>
            <Item off>Загрузка документов</Item>
          </ul>
          <PillLink to="/auth" variant="outline" size="sm" className="pricing__cta">Начать бесплатно</PillLink>
        </div>

        <div className="pricing__card pricing__card--featured">
          <span className="pricing__badge">Рекомендуем</span>
          <div className="pricing__head">
            <h2 className="pricing__name">Профессиональный</h2>
            <p className="pricing__desc">Когда уже есть презентация или описание проекта</p>
          </div>
          <div className="pricing__price-row">
            <p className="pricing__price">{proPrice}</p>
            <span className="pricing__period">за 30 дней</span>
          </div>
          {renew && <span className="pricing__discount">Скидка 15% при продлении</span>}
          <ul className="pricing__list">
            <Item>Всё из Базового</Item>
            <Item>Разбор PDF, DOCX, PPTX и сканов</Item>
            <Item>До 10 файлов</Item>
            <Item>Проверка новизны и аналогов</Item>
          </ul>
          <PillLink to="/auth" variant="brand" size="sm" className="pricing__cta">Выбрать Профессиональный</PillLink>
        </div>

        <div className="pricing__card">
          <div className="pricing__head">
            <h2 className="pricing__name">Премиум</h2>
            <p className="pricing__desc">Много материалов и помощь консультанта</p>
          </div>
          <div className="pricing__price-row">
            <p className="pricing__price">{premPrice}</p>
            <span className="pricing__period">за 30 дней</span>
          </div>
          {renew && <span className="pricing__discount">Скидка 10% при продлении</span>}
          <ul className="pricing__list">
            <Item>Всё из Профессионального</Item>
            <Item>До 50 файлов</Item>
            <Item>Консультант [ФОРМАТ КОНСУЛЬТАЦИИ]</Item>
          </ul>
          <PillLink to="/auth" variant="outline" size="sm" className="pricing__cta">Выбрать Премиум</PillLink>
        </div>
      </section>

      <section className="pricing__table-section">
        <h2 className="t-screen-title">Сравнение возможностей</h2>
        <div className="pricing__table-wrap">
          <table className="pricing__table">
            <thead>
              <tr className="pricing__table-head">
                <th scope="col">Возможность</th>
                <th scope="col" className="pricing__th-center">Базовый</th>
                <th scope="col" className="pricing__th-center pricing__th-pro">Профессиональный</th>
                <th scope="col" className="pricing__th-center">Премиум</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map((row) => (
                <tr key={row.feature} className="pricing__table-row">
                  <th scope="row" className="pricing__row-title">{row.feature}</th>
                  <td className={row.base.off ? 'pricing__cell pricing__cell--off' : 'pricing__cell'}>{row.base.text}</td>
                  <td className={row.pro.off ? 'pricing__cell pricing__cell--off' : 'pricing__cell'}>{row.pro.text}</td>
                  <td className={row.premium.off ? 'pricing__cell pricing__cell--off' : 'pricing__cell'}>{row.premium.text}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="pricing__notes">
        <div className="pricing__note">
          <h3 className="pricing__note-title">Оплата через ЮKassa</h3>
          <p className="pricing__note-text">Картой или через СБП. Доступ открывается сразу после подтверждения платежа.</p>
        </div>
        <div className="pricing__note">
          <h3 className="pricing__note-title">30 дней доступа</h3>
          <p className="pricing__note-text">По окончании вы вернётесь на Базовый. Паспорт, файлы и экспорт сохранятся.</p>
        </div>
        <div className="pricing__note pricing__note--dark">
          <h3 className="pricing__note-title">Один аккаунт — один проект</h3>
          <p className="pricing__note-text pricing__note-text--peach">Тариф действует для вашего проекта. Материалы другого проекта система не примет.</p>
        </div>
      </section>
    </SiteLayout>
  );
}
