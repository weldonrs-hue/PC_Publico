'use client';

import React from 'react';
import {
  VisitSchedule,
  StudyVisitRow,
  ShepherdingRow,
  ElderSuggestedTopic,
  ElderSubmittedRecommendation,
  ElderSubmittedRemoval,
} from '@/types/visitSchedule';

interface SemanaVisitaPrintProps {
  data: VisitSchedule;
  onChange?: (updated: VisitSchedule) => void;
  isReadOnly?: boolean;
  elderMode?: boolean;
  filterRole?: 'all' | 'esposa' | 'viajante';
}

interface SchedulePageDefinition {
  kind: 'schedule';
  pageId: string;
  pageNumber: number;
  label: string;
  copyOwnerBadge: string;
  headerSubtitle: string;
  isSubtitleEditable: boolean;
  onSubtitleChange?: (val: string) => void;
  // Estudos - Primeiro Cônjuge (Marido / Viajante / Irmão)
  primaryBadgeName: string;
  isPrimaryBadgeEditable: boolean;
  onPrimaryBadgeChange?: (val: string) => void;
  primaryStudyRows: StudyVisitRow[];
  onPrimaryStudyRowChange: (idx: number, field: keyof StudyVisitRow, val: string) => void;
  // Estudos - Segundo Cônjuge (Esposa) quando casado
  hasSpouse: boolean;
  spouseBadgeName?: string;
  isSpouseBadgeEditable?: boolean;
  onSpouseBadgeChange?: (val: string) => void;
  spouseStudyRows?: StudyVisitRow[];
  onSpouseStudyRowChange?: (idx: number, field: keyof StudyVisitRow, val: string) => void;
}

interface ConfidentialPageDefinition {
  kind: 'confidential';
  pageId: string;
  pageNumber: number;
  label: string;
  copyOwnerBadge: string;
  headerSubtitle: string;
  pastoreioTitle: string;
  pastoreioRows: ShepherdingRow[];
  onPastoreioRowChange: (idx: number, field: keyof ShepherdingRow, val: string) => void;
  includeEldersAgendaSection: boolean;
}

type PrintPageDefinition = SchedulePageDefinition | ConfidentialPageDefinition;

export default function SemanaVisitaPrint({
  data,
  onChange,
  isReadOnly = false,
  elderMode = false,
  filterRole = 'all',
}: SemanaVisitaPrintProps) {
  const update = (updater: (prev: VisitSchedule) => VisitSchedule) => {
    if (isReadOnly || !onChange) return;
    onChange(updater(data));
  };

  const canEdit = (
    fieldKey:
      | 'midweekMeeting'
      | 'weekendMeeting'
      | 'fieldService'
      | 'meals'
      | 'shepherding'
      | 'studies'
      | 'additionalMeetings'
      | 'eldersAgendaInput'
      | 'circuitOverseerOnly'
  ) => {
    if (isReadOnly) return false;
    if (!elderMode) return true;
    switch (fieldKey) {
      case 'midweekMeeting':
        return data.permissions?.allowMidweekMeetingTimeEdit ?? true;
      case 'weekendMeeting':
        return data.permissions?.allowWeekendMeetingTimeEdit ?? true;
      case 'fieldService':
        return data.permissions?.allowFieldServiceEdit ?? true;
      case 'meals':
        return data.permissions?.allowMealsEdit ?? true;
      case 'shepherding':
        return data.permissions?.allowShepherdingEdit ?? true;
      case 'studies':
        return data.permissions?.allowStudiesEdit ?? true;
      case 'additionalMeetings':
        return data.permissions?.allowAdditionalMeetingsEdit ?? true;
      case 'eldersAgendaInput':
        return data.permissions?.allowEldersAgendaInputEdit ?? true;
      case 'circuitOverseerOnly':
        return false;
      default:
        return false;
    }
  };

  // Construir a lista de páginas:
  // Página 1: Programação Geral da Semana (Campo, Estudos de ambos, Reuniões, Reuniões Adicionais, Refeições) — Sem pastoreio (serve para o casal e esposa)
  // Página 2: Pastoreio (com amplo espaço para Situação) + Sugestões de Pauta + Recomendações e Remoções (exclusiva para maridos / anciãos)
  // Se houver Acompanhante (Visita Acompanhada):
  //   - Página de Programação Geral do Acompanhante (e esposa dele, se casado)
  //   - Página de Pastoreio do Acompanhante (se tiver pastoreio habilitado)
  const pages: PrintPageDefinition[] = [];
  let currentPageNum = 1;

  const husbandLabel = data.studiesAndVisits.husbandName || 'VIAJANTE';
  const wifeLabel = data.studiesAndVisits.wifeName || 'ESPOSA';

  // PÁGINA 1: PROGRAMAÇÃO GERAL DA SEMANA (CASAL / ESPOSA)
  pages.push({
    kind: 'schedule',
    pageId: 'programacao-casal',
    pageNumber: currentPageNum++,
    label: `Página 1: Programação da Semana (${data.coupleNames || `${husbandLabel} & ${wifeLabel}`})`,
    copyOwnerBadge: `PROGRAMAÇÃO GERAL • CASAL`,
    headerSubtitle: data.coupleNames || '',
    isSubtitleEditable: true,
    onSubtitleChange: (val) => update((prev) => ({ ...prev, coupleNames: val })),
    primaryBadgeName: husbandLabel,
    isPrimaryBadgeEditable: true,
    onPrimaryBadgeChange: (val) =>
      update((prev) => ({
        ...prev,
        studiesAndVisits: { ...prev.studiesAndVisits, husbandName: val },
      })),
    primaryStudyRows: data.studiesAndVisits.husbandRows || [],
    onPrimaryStudyRowChange: (idx, field, val) =>
      update((prev) => {
        const updated = [...prev.studiesAndVisits.husbandRows];
        updated[idx] = { ...updated[idx], [field]: val };
        return { ...prev, studiesAndVisits: { ...prev.studiesAndVisits, husbandRows: updated } };
      }),
    hasSpouse: true,
    spouseBadgeName: wifeLabel,
    isSpouseBadgeEditable: true,
    onSpouseBadgeChange: (val) =>
      update((prev) => ({
        ...prev,
        studiesAndVisits: { ...prev.studiesAndVisits, wifeName: val },
      })),
    spouseStudyRows: data.studiesAndVisits.wifeRows || [],
    onSpouseStudyRowChange: (idx, field, val) =>
      update((prev) => {
        const updated = [...prev.studiesAndVisits.wifeRows];
        updated[idx] = { ...updated[idx], [field]: val };
        return { ...prev, studiesAndVisits: { ...prev.studiesAndVisits, wifeRows: updated } };
      }),
  });

  // PÁGINA 2: PASTOREIO, PAUTA E RECOMENDAÇÕES (EXCLUSIVO MARIDO / ANCIÃOS)
  pages.push({
    kind: 'confidential',
    pageId: 'pastoreio-viajante',
    pageNumber: currentPageNum++,
    label: `Página 2: Pastoreio, Pauta e Recomendações (${husbandLabel})`,
    copyOwnerBadge: `PASTOREIO & ANCIÃOS • ${husbandLabel}`,
    headerSubtitle: [data.congregationName, data.visitPeriod, data.coupleNames]
      .filter(Boolean)
      .join(' • '),
    pastoreioTitle: `VISITAS DE PASTOREIO (${husbandLabel})`,
    pastoreioRows: data.shepherding || [],
    onPastoreioRowChange: (idx, field, val) =>
      update((prev) => {
        const updated = [...prev.shepherding];
        updated[idx] = { ...updated[idx], [field]: val };
        return { ...prev, shepherding: updated };
      }),
    includeEldersAgendaSection: true,
  });

  // PÁGINAS DO(S) ACOMPANHANTE(S) (VISITA ACOMPANHADA)
  (data.studiesAndVisits.companions || []).forEach((comp, compIdx) => {
    const compName = comp.name || `ACOMPANHANTE #${compIdx + 1}`;
    const compPageNum = currentPageNum++;

    // 1. Página de Programação Geral do Acompanhante (e esposa dele, se casado) — sem pastoreio
    pages.push({
      kind: 'schedule',
      pageId: `programacao-companion-${comp.id || compIdx}`,
      pageNumber: compPageNum,
      label: `Página ${compPageNum}: Programação — Acompanhante (${compName}${comp.hasWife && comp.wifeName ? ` & ${comp.wifeName}` : ''})`,
      copyOwnerBadge: `PROGRAMAÇÃO • ${compName}`,
      headerSubtitle: comp.name
        ? data.coupleNames
          ? `${data.coupleNames} — Acompanhante: ${comp.name}${comp.hasWife && comp.wifeName ? ` e ${comp.wifeName}` : ''}`
          : `Acompanhante: ${comp.name}${comp.hasWife && comp.wifeName ? ` e ${comp.wifeName}` : ''}`
        : data.coupleNames || 'Visita Acompanhada',
      isSubtitleEditable: false,
      primaryBadgeName: compName,
      isPrimaryBadgeEditable: true,
      onPrimaryBadgeChange: (val) =>
        update((prev) => {
          const comps = [...(prev.studiesAndVisits.companions || [])];
          comps[compIdx] = { ...comps[compIdx], name: val };
          return { ...prev, studiesAndVisits: { ...prev.studiesAndVisits, companions: comps } };
        }),
      primaryStudyRows: comp.rows || [],
      onPrimaryStudyRowChange: (idx, field, val) =>
        update((prev) => {
          const comps = [...(prev.studiesAndVisits.companions || [])];
          const updatedRows = [...comps[compIdx].rows];
          updatedRows[idx] = { ...updatedRows[idx], [field]: val };
          comps[compIdx] = { ...comps[compIdx], rows: updatedRows };
          return { ...prev, studiesAndVisits: { ...prev.studiesAndVisits, companions: comps } };
        }),
      hasSpouse: !!comp.hasWife,
      spouseBadgeName: comp.wifeName || 'ESPOSA',
      isSpouseBadgeEditable: true,
      onSpouseBadgeChange: (val) =>
        update((prev) => {
          const comps = [...(prev.studiesAndVisits.companions || [])];
          comps[compIdx] = { ...comps[compIdx], wifeName: val };
          return { ...prev, studiesAndVisits: { ...prev.studiesAndVisits, companions: comps } };
        }),
      spouseStudyRows: comp.wifeRows || [],
      onSpouseStudyRowChange: (idx, field, val) =>
        update((prev) => {
          const comps = [...(prev.studiesAndVisits.companions || [])];
          const updatedRows = [...(comps[compIdx].wifeRows || [])];
          updatedRows[idx] = { ...updatedRows[idx], [field]: val };
          comps[compIdx] = { ...comps[compIdx], wifeRows: updatedRows };
          return { ...prev, studiesAndVisits: { ...prev.studiesAndVisits, companions: comps } };
        }),
    });

    // 2. Página de Pastoreio do Acompanhante (se tiver pastoreio habilitado)
    if (comp.hasShepherding && comp.shepherding && comp.shepherding.length > 0) {
      const compPastoreioPageNum = currentPageNum++;
      pages.push({
        kind: 'confidential',
        pageId: `pastoreio-companion-${comp.id || compIdx}`,
        pageNumber: compPastoreioPageNum,
        label: `Página ${compPastoreioPageNum}: Pastoreio e Pauta — Acompanhante (${compName})`,
        copyOwnerBadge: `PASTOREIO • ${compName}`,
        headerSubtitle: [data.congregationName, data.visitPeriod, `Acompanhante: ${compName}`]
          .filter(Boolean)
          .join(' • '),
        pastoreioTitle: `VISITAS DE PASTOREIO (${compName})`,
        pastoreioRows: comp.shepherding || [],
        onPastoreioRowChange: (idx, field, val) =>
          update((prev) => {
            const comps = [...(prev.studiesAndVisits.companions || [])];
            const updatedSh = [...(comps[compIdx].shepherding || [])];
            updatedSh[idx] = { ...updatedSh[idx], [field]: val };
            comps[compIdx] = { ...comps[compIdx], shepherding: updatedSh };
            return { ...prev, studiesAndVisits: { ...prev.studiesAndVisits, companions: comps } };
          }),
        includeEldersAgendaSection: true,
      });
    }
  });

  // Se for visão da esposa (filterRole === 'esposa'), exibe apenas as páginas de Programação Geral (sem pastoreio/pauta)
  const renderedPages =
    filterRole === 'esposa'
      ? pages.filter((p) => p.kind === 'schedule')
      : pages;

  // Dados de pauta, recomendações e remoções para a Página 2
  const suggestedTopics: ElderSuggestedTopic[] = data.eldersMeetingInput?.suggestedTopics || [];
  const recommendations: ElderSubmittedRecommendation[] = data.eldersMeetingInput?.recommendations || [];
  const removals: ElderSubmittedRemoval[] = data.eldersMeetingInput?.removals || [];

  const displayTopics: ElderSuggestedTopic[] =
    suggestedTopics.length > 0
      ? suggestedTopics
      : [
          { id: 'empty_t1', subject: '', reference: '', suggestedBy: '' },
          { id: 'empty_t2', subject: '', reference: '', suggestedBy: '' },
          { id: 'empty_t3', subject: '', reference: '', suggestedBy: '' },
        ];

  const displayRecommendations: ElderSubmittedRecommendation[] =
    recommendations.length > 0
      ? recommendations
      : [
          { id: 'empty_r1', name: '', role: 'elder', notes: '' },
          { id: 'empty_r2', name: '', role: 'servant', notes: '' },
          { id: 'empty_r3', name: '', role: 'servant', notes: '' },
        ];

  const displayRemovals: ElderSubmittedRemoval[] =
    removals.length > 0
      ? removals
      : [
          { id: 'empty_rem1', name: '', role: 'elder', reason: '' },
          { id: 'empty_rem2', name: '', role: 'servant', reason: '' },
          { id: 'empty_rem3', name: '', role: 'servant', reason: '' },
        ];

  return (
    <div className="semana-visita-wrapper">
      {/* BARRA DE IMPRESSÃO */}
      <div className="print-bar">
        <div className="print-bar-info">
          <span>
            Programação da Semana da Visita —{' '}
            <strong>
              {renderedPages.length} {renderedPages.length === 1 ? 'página' : 'páginas'} para impressão
            </strong>
          </span>
        </div>
        <button className="btn-print" onClick={() => window.print()}>
          <svg viewBox="0 0 24 24">
            <path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z" />
          </svg>
          Imprimir / Salvar PDF ({renderedPages.length} {renderedPages.length === 1 ? 'pág' : 'págs'})
        </button>
      </div>

      {/* RENDERIZAÇÃO DE CADA PÁGINA A4 */}
      {renderedPages.map((page, index) => (
        <div className="page-wrapper" key={page.pageId}>
          {/* Indicador de página visível na tela */}
          <div className="page-indicator">
            <span>{page.label}</span>
            <span className="page-indicator-counter">
              Página {index + 1} de {renderedPages.length}
            </span>
          </div>

          {page.kind === 'schedule' ? (
            /* =========================================================================
               PÁGINA DE PROGRAMAÇÃO GERAL (SERVE PARA CASAL / ESPOSA) — SEM PASTOREIO
               ========================================================================= */
            <div className="page">
              {/* HEADER */}
              <div className="header">
                <div className="header-left">
                  <div className="header-icon">
                    <svg viewBox="0 0 24 24">
                      <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
                    </svg>
                  </div>
                  <div className="header-title">
                    <div className="header-title-top">
                      <h1>SEMANA DA VISITA</h1>
                      <span className="copy-owner-badge">{page.copyOwnerBadge}</span>
                    </div>
                    <p>
                      <input
                        type="text"
                        value={page.headerSubtitle}
                        disabled={!page.isSubtitleEditable || !canEdit('circuitOverseerOnly')}
                        onChange={(e) => page.onSubtitleChange && page.onSubtitleChange(e.target.value)}
                      />
                    </p>
                  </div>
                </div>
                <div className="header-days">
                  {(['ter', 'qua', 'qui', 'sex', 'sab', 'dom'] as const).map((dayKey) => (
                    <div className="header-day" key={dayKey}>
                      <label>{dayKey.toUpperCase()}</label>
                      <input
                        type="checkbox"
                        checked={!!(data.activeDays && data.activeDays[dayKey])}
                        disabled={!canEdit('circuitOverseerOnly')}
                        onChange={(e) =>
                          update((prev) => ({
                            ...prev,
                            activeDays: { ...(prev.activeDays || {}), [dayKey]: e.target.checked },
                          }))
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* SERVIÇO DE CAMPO + ESTUDOS */}
              <div className="two-columns" style={{ flex: 2.8, minHeight: 0 }}>
                {/* SERVIÇO DE CAMPO */}
                <div className="section stretch">
                  <div className="section-header">
                    <div className="section-icon">
                      <svg viewBox="0 0 24 24">
                        <path d="M13.49 5.48c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm-3.6 13.9l1-4.4 2.1 2v6h2v-7.5l-2.1-2 .6-3c1.3 1.5 3.3 2.5 5.5 2.5v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1l-5.2 2.2v4.7h2v-3.4l1.8-.7-1.6 8.1-4.9-1-.4 2 7 1.4z" />
                      </svg>
                    </div>
                    <h2>SERVIÇO DE CAMPO</h2>
                  </div>
                  <table>
                    <thead>
                      <tr>
                        <th style={{ width: '32%' }}>DIA</th>
                        <th style={{ width: '28%' }}>HORÁRIO</th>
                        <th style={{ width: '40%' }}>LOCAL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.fieldService.map((row, idx) => (
                        <tr key={row.id || idx}>
                          <td>
                            <span className="day-icon">
                              <svg viewBox="0 0 24 24">
                                <path
                                  d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11z"
                                  fill="#aaa"
                                />
                              </svg>
                            </span>
                            <input
                              type="text"
                              className="editable-field"
                              style={{ width: '66%' }}
                              value={row.day}
                              disabled={!canEdit('circuitOverseerOnly')}
                              onChange={(e) =>
                                update((prev) => {
                                  const newRows = [...prev.fieldService];
                                  newRows[idx] = { ...newRows[idx], day: e.target.value };
                                  return { ...prev, fieldService: newRows };
                                })
                              }
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              className="editable-field"
                              value={row.time}
                              disabled={!canEdit('circuitOverseerOnly')}
                              onChange={(e) =>
                                update((prev) => {
                                  const newRows = [...prev.fieldService];
                                  newRows[idx] = { ...newRows[idx], time: e.target.value };
                                  return { ...prev, fieldService: newRows };
                                })
                              }
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              className="editable-field"
                              value={row.location}
                              disabled={!canEdit('fieldService')}
                              onChange={(e) =>
                                update((prev) => {
                                  const newRows = [...prev.fieldService];
                                  newRows[idx] = { ...newRows[idx], location: e.target.value };
                                  return { ...prev, fieldService: newRows };
                                })
                              }
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* ESTUDOS E REVISITAS (AMBOS OS CÔNJUGES) */}
                <div className="section stretch" style={{ overflow: 'hidden' }}>
                  <div className="section-header">
                    <div className="section-icon">
                      <svg viewBox="0 0 24 24">
                        <path d="M21 5c-1.11-.35-2.33-.5-3.5-.5-1.95 0-4.05.4-5.5 1.5-1.45-1.1-3.55-1.5-5.5-1.5S2.45 4.9 1 6v14.65c0 .25.25.5.5.5.1 0 .15-.05.25-.05C3.1 20.45 5.05 20 6.5 20c1.95 0 4.05.4 5.5 1.5 1.35-.85 3.8-1.5 5.5-1.5 1.65 0 3.35.3 4.75 1.05.1.05.15.05.25.05.25 0 .5-.25.5-.5V6c-.6-.45-1.25-.75-2-1zm0 13.5c-1.1-.35-2.3-.5-3.5-.5-1.7 0-4.15.65-5.5 1.5V8c1.35-.85 3.8-1.5 5.5-1.5 1.2 0 2.4.15 3.5.5v11.5z" />
                      </svg>
                    </div>
                    <h2>ESTUDOS E REVISITAS</h2>
                  </div>

                  <div
                    style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '5px',
                      minHeight: 0,
                      overflow: 'hidden',
                    }}
                  >
                    {/* PRIMEIRO CÔNJUGE (MARIDO / VIAJANTE / IRMÃO) */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                      <div className="name-badge">
                        <span className="name-badge-sizer">
                          <span className="name-badge-mirror" aria-hidden="true">
                            {page.primaryBadgeName || ' '}
                          </span>
                          <input
                            type="text"
                            value={page.primaryBadgeName}
                            disabled={!page.isPrimaryBadgeEditable || !canEdit('circuitOverseerOnly')}
                            onChange={(e) => page.onPrimaryBadgeChange && page.onPrimaryBadgeChange(e.target.value)}
                          />
                        </span>
                      </div>
                      <table style={{ flex: 1 }}>
                        <thead>
                          <tr>
                            <th style={{ width: '18%' }}>DIA</th>
                            <th style={{ width: '18%' }}>HORÁRIO</th>
                            <th style={{ width: '42%' }}>ACOMPANHANTE / TEL</th>
                            <th style={{ width: '22%' }}>LIÇÃO</th>
                          </tr>
                        </thead>
                        <tbody>
                          {page.primaryStudyRows.map((row, idx) => (
                            <tr key={row.id || idx}>
                              <td>
                                <input
                                  type="text"
                                  className="editable-field"
                                  value={row.day}
                                  disabled={!canEdit('circuitOverseerOnly')}
                                  onChange={(e) => page.onPrimaryStudyRowChange(idx, 'day', e.target.value)}
                                />
                              </td>
                              <td>
                                <input
                                  type="text"
                                  className="editable-field"
                                  value={row.time}
                                  disabled={!canEdit('circuitOverseerOnly')}
                                  onChange={(e) => page.onPrimaryStudyRowChange(idx, 'time', e.target.value)}
                                />
                              </td>
                              <td>
                                <input
                                  type="text"
                                  className="editable-field"
                                  value={row.companionPhone}
                                  disabled={!canEdit('studies')}
                                  onChange={(e) => page.onPrimaryStudyRowChange(idx, 'companionPhone', e.target.value)}
                                />
                              </td>
                              <td>
                                <input
                                  type="text"
                                  className="editable-field"
                                  value={row.lesson}
                                  disabled={!canEdit('studies')}
                                  onChange={(e) => page.onPrimaryStudyRowChange(idx, 'lesson', e.target.value)}
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* SEGUNDO CÔNJUGE (ESPOSA) SE HOUVER */}
                    {page.hasSpouse && page.spouseStudyRows && (
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                        <div className="name-badge">
                          <span className="name-badge-sizer">
                            <span className="name-badge-mirror" aria-hidden="true">
                              {page.spouseBadgeName || 'ESPOSA'}
                            </span>
                            <input
                              type="text"
                              value={page.spouseBadgeName || 'ESPOSA'}
                              disabled={!page.isSpouseBadgeEditable || !canEdit('circuitOverseerOnly')}
                              onChange={(e) => page.onSpouseBadgeChange && page.onSpouseBadgeChange(e.target.value)}
                            />
                          </span>
                        </div>
                        <table style={{ flex: 1 }}>
                          <thead>
                            <tr>
                              <th style={{ width: '18%' }}>DIA</th>
                              <th style={{ width: '18%' }}>HORÁRIO</th>
                              <th style={{ width: '42%' }}>ACOMPANHANTE / TEL</th>
                              <th style={{ width: '22%' }}>LIÇÃO</th>
                            </tr>
                          </thead>
                          <tbody>
                            {page.spouseStudyRows.map((row, idx) => (
                              <tr key={row.id || idx}>
                                <td>
                                  <input
                                    type="text"
                                    className="editable-field"
                                    value={row.day}
                                    disabled={!canEdit('circuitOverseerOnly')}
                                    onChange={(e) =>
                                      page.onSpouseStudyRowChange &&
                                      page.onSpouseStudyRowChange(idx, 'day', e.target.value)
                                    }
                                  />
                                </td>
                                <td>
                                  <input
                                    type="text"
                                    className="editable-field"
                                    value={row.time}
                                    disabled={!canEdit('circuitOverseerOnly')}
                                    onChange={(e) =>
                                      page.onSpouseStudyRowChange &&
                                      page.onSpouseStudyRowChange(idx, 'time', e.target.value)
                                    }
                                  />
                                </td>
                                <td>
                                  <input
                                    type="text"
                                    className="editable-field"
                                    value={row.companionPhone}
                                    disabled={!canEdit('studies')}
                                    onChange={(e) =>
                                      page.onSpouseStudyRowChange &&
                                      page.onSpouseStudyRowChange(idx, 'companionPhone', e.target.value)
                                    }
                                  />
                                </td>
                                <td>
                                  <input
                                    type="text"
                                    className="editable-field"
                                    value={row.lesson}
                                    disabled={!canEdit('studies')}
                                    onChange={(e) =>
                                      page.onSpouseStudyRowChange &&
                                      page.onSpouseStudyRowChange(idx, 'lesson', e.target.value)
                                    }
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* INFORMAÇÕES DAS REUNIÕES */}
              <div className="section" style={{ flexShrink: 0 }}>
                <div className="section-header">
                  <div className="section-icon">
                    <svg viewBox="0 0 24 24">
                      <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
                    </svg>
                  </div>
                  <h2>INFORMAÇÕES DAS REUNIÕES</h2>
                </div>

                {/* REUNIÃO DO MEIO DE SEMANA */}
                <div className="meeting-row" style={{ borderBottom: 0 }}>
                  <div className="meeting-row-container">
                    <div className="meeting-row-left">
                      <span className="meeting-label">REUNIÃO DO MEIO DE SEMANA</span>
                    </div>
                    <div className="meeting-row-right">
                      <div className="horario-badge">
                        <span className="meeting-field-label">HORÁRIO:</span>
                        <input
                          type="text"
                          className="meeting-input small"
                          value={data.meetings.midweek.time}
                          disabled={!canEdit('midweekMeeting')}
                          onChange={(e) =>
                            update((prev) => ({
                              ...prev,
                              meetings: {
                                ...prev.meetings,
                                midweek: { ...prev.meetings.midweek, time: e.target.value },
                              },
                            }))
                          }
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="meeting-row" style={{ borderBottom: 0 }}>
                  <div className="meeting-row-left">
                    <span className="meeting-label" style={{ marginLeft: 20 }}>
                      DISCURSO DE SERVIÇO
                    </span>
                    <div className="meeting-field-group">
                      <span className="meeting-field-label">TEMA:</span>
                      <input
                        type="text"
                        className="meeting-input"
                        style={{ width: 430 }}
                        value={data.meetings.midweek.serviceTalkTheme}
                        disabled={!canEdit('circuitOverseerOnly')}
                        onChange={(e) =>
                          update((prev) => ({
                            ...prev,
                            meetings: {
                              ...prev.meetings,
                              midweek: { ...prev.meetings.midweek, serviceTalkTheme: e.target.value },
                            },
                          }))
                        }
                      />
                    </div>
                    <div className="meeting-field-group">
                      <span className="meeting-field-label">CÂNTICO:</span>
                      <input
                        type="text"
                        className="meeting-input small"
                        style={{ width: 45 }}
                        value={data.meetings.midweek.serviceTalkSong}
                        disabled={!canEdit('circuitOverseerOnly')}
                        onChange={(e) =>
                          update((prev) => ({
                            ...prev,
                            meetings: {
                              ...prev.meetings,
                              midweek: { ...prev.meetings.midweek, serviceTalkSong: e.target.value },
                            },
                          }))
                        }
                      />
                    </div>
                  </div>
                </div>

                <div className="meeting-row" style={{ borderBottom: 0 }}>
                  <div className="meeting-row-left">
                    <span className="meeting-label" style={{ marginLeft: 20 }}>
                      ORAÇÃO FINAL
                    </span>
                    <div className="meeting-field-group">
                      <span className="meeting-field-label">IRMÃO:</span>
                      <input
                        type="text"
                        className="meeting-input"
                        value={data.meetings.midweek.finalPrayerBrother}
                        disabled={!canEdit('weekendMeeting')}
                        onChange={(e) =>
                          update((prev) => ({
                            ...prev,
                            meetings: {
                              ...prev.meetings,
                              midweek: { ...prev.meetings.midweek, finalPrayerBrother: e.target.value },
                            },
                          }))
                        }
                      />
                    </div>
                  </div>
                </div>

                <hr className="info-section-divider" />

                {/* REUNIÃO DE FIM DE SEMANA */}
                <div className="meeting-row" style={{ borderBottom: 0 }}>
                  <div className="meeting-row-container">
                    <div className="meeting-row-left">
                      <span className="meeting-label">REUNIÃO DE FIM DE SEMANA</span>
                    </div>
                    <div className="meeting-row-right">
                      <div className="day-checkbox-group">
                        <div className="day-check-item">
                          <input
                            type="checkbox"
                            id={`sab-${page.pageId}`}
                            checked={data.meetings.weekend.day === 'sabado'}
                            disabled={!canEdit('weekendMeeting')}
                            onChange={(e) =>
                              update((prev) => ({
                                ...prev,
                                meetings: {
                                  ...prev.meetings,
                                  weekend: {
                                    ...prev.meetings.weekend,
                                    day: e.target.checked ? 'sabado' : '',
                                  },
                                },
                              }))
                            }
                          />
                          <label htmlFor={`sab-${page.pageId}`}>SÁBADO</label>
                        </div>
                        <div className="day-check-item">
                          <input
                            type="checkbox"
                            id={`dom-${page.pageId}`}
                            checked={data.meetings.weekend.day === 'domingo'}
                            disabled={!canEdit('weekendMeeting')}
                            onChange={(e) =>
                              update((prev) => ({
                                ...prev,
                                meetings: {
                                  ...prev.meetings,
                                  weekend: {
                                    ...prev.meetings.weekend,
                                    day: e.target.checked ? 'domingo' : '',
                                  },
                                },
                              }))
                            }
                          />
                          <label htmlFor={`dom-${page.pageId}`}>DOMINGO</label>
                        </div>
                      </div>

                      <div className="horario-badge">
                        <span className="meeting-field-label">HORÁRIO:</span>
                        <input
                          type="text"
                          className="meeting-input small"
                          value={data.meetings.weekend.time}
                          disabled={!canEdit('weekendMeeting')}
                          onChange={(e) =>
                            update((prev) => ({
                              ...prev,
                              meetings: {
                                ...prev.meetings,
                                weekend: { ...prev.meetings.weekend, time: e.target.value },
                              },
                            }))
                          }
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="meeting-row" style={{ borderBottom: 0 }}>
                  <div className="meeting-row-left">
                    <span className="meeting-label" style={{ marginLeft: 20 }}>
                      DISCURSO PÚBLICO
                    </span>
                    <div className="meeting-field-group">
                      <span className="meeting-field-label">TEMA:</span>
                      <input
                        type="text"
                        className="meeting-input"
                        style={{ width: 430 }}
                        value={data.meetings.weekend.publicTalkTheme}
                        disabled={!canEdit('circuitOverseerOnly')}
                        onChange={(e) =>
                          update((prev) => ({
                            ...prev,
                            meetings: {
                              ...prev.meetings,
                              weekend: { ...prev.meetings.weekend, publicTalkTheme: e.target.value },
                            },
                          }))
                        }
                      />
                    </div>
                    <div className="meeting-field-group">
                      <span className="meeting-field-label">CÂNTICO:</span>
                      <input
                        type="text"
                        className="meeting-input small"
                        style={{ width: 45 }}
                        value={data.meetings.weekend.publicTalkSong}
                        disabled={!canEdit('circuitOverseerOnly')}
                        onChange={(e) =>
                          update((prev) => ({
                            ...prev,
                            meetings: {
                              ...prev.meetings,
                              weekend: { ...prev.meetings.weekend, publicTalkSong: e.target.value },
                            },
                          }))
                        }
                      />
                    </div>
                  </div>
                </div>

                <div className="meeting-row">
                  <div className="meeting-row-left">
                    <span className="meeting-label" style={{ marginLeft: 20 }}>
                      DISCURSO FINAL
                    </span>
                    <div className="meeting-field-group">
                      <span className="meeting-field-label">TEMA:</span>
                      <input
                        type="text"
                        className="meeting-input"
                        style={{ width: 430 }}
                        value={data.meetings.weekend.finalTalkTheme}
                        disabled={!canEdit('circuitOverseerOnly')}
                        onChange={(e) =>
                          update((prev) => ({
                            ...prev,
                            meetings: {
                              ...prev.meetings,
                              weekend: { ...prev.meetings.weekend, finalTalkTheme: e.target.value },
                            },
                          }))
                        }
                      />
                    </div>
                    <div className="meeting-field-group">
                      <span className="meeting-field-label">CÂNTICO:</span>
                      <input
                        type="text"
                        className="meeting-input small"
                        style={{ width: 45 }}
                        value={data.meetings.weekend.finalTalkSong}
                        disabled={!canEdit('circuitOverseerOnly')}
                        onChange={(e) =>
                          update((prev) => ({
                            ...prev,
                            meetings: {
                              ...prev.meetings,
                              weekend: { ...prev.meetings.weekend, finalTalkSong: e.target.value },
                            },
                          }))
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* REUNIÕES ADICIONAIS + REFEIÇÕES */}
              <div className="row-fixed" style={{ flex: 1.7, minHeight: 0 }}>
                {/* REUNIÕES ADICIONAIS */}
                <div className="section stretch adicionais" style={{ flex: 0.9, overflow: 'hidden' }}>
                  <div className="section-header">
                    <div className="section-icon">
                      <svg viewBox="0 0 24 24">
                        <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
                      </svg>
                    </div>
                    <h2>REUNIÕES ADICIONAIS</h2>
                  </div>
                  <table style={{ height: 'calc(100% - 40px)' }}>
                    <thead>
                      <tr>
                        <th style={{ width: '55%' }}>REUNIÃO</th>
                        <th style={{ width: '25%' }}>DIA</th>
                        <th style={{ width: '20%' }}>HORÁRIO</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ height: '50%' }}>
                        <td>
                          <span className="reuniao-icon">
                            <svg viewBox="0 0 24 24">
                              <path
                                d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"
                                fill="#888"
                              />
                            </svg>
                          </span>
                          Pioneiros
                        </td>
                        <td>
                          <input
                            type="text"
                            className="editable-field"
                            value={data.additionalMeetings.pioneers.day}
                            disabled={!canEdit('additionalMeetings')}
                            onChange={(e) =>
                              update((prev) => ({
                                ...prev,
                                additionalMeetings: {
                                  ...prev.additionalMeetings,
                                  pioneers: { ...prev.additionalMeetings.pioneers, day: e.target.value },
                                },
                              }))
                            }
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className="editable-field"
                            value={data.additionalMeetings.pioneers.time}
                            disabled={!canEdit('additionalMeetings')}
                            onChange={(e) =>
                              update((prev) => ({
                                ...prev,
                                additionalMeetings: {
                                  ...prev.additionalMeetings,
                                  pioneers: { ...prev.additionalMeetings.pioneers, time: e.target.value },
                                },
                              }))
                            }
                          />
                        </td>
                      </tr>
                      <tr style={{ height: '50%' }}>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <span className="reuniao-icon">
                            <svg viewBox="0 0 24 24">
                              <path
                                d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"
                                fill="#888"
                              />
                            </svg>
                          </span>
                          Anciãos e Servos Ministeriais
                        </td>
                        <td>
                          <input
                            type="text"
                            className="editable-field"
                            value={data.additionalMeetings.eldersAndServants.day}
                            disabled={!canEdit('additionalMeetings')}
                            onChange={(e) =>
                              update((prev) => ({
                                ...prev,
                                additionalMeetings: {
                                  ...prev.additionalMeetings,
                                  eldersAndServants: {
                                    ...prev.additionalMeetings?.eldersAndServants,
                                    day: e.target.value,
                                    time: prev.additionalMeetings?.eldersAndServants?.time || '',
                                  },
                                },
                              }))
                            }
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className="editable-field"
                            value={data.additionalMeetings.eldersAndServants.time}
                            disabled={!canEdit('additionalMeetings')}
                            onChange={(e) =>
                              update((prev) => ({
                                ...prev,
                                additionalMeetings: {
                                  ...prev.additionalMeetings,
                                  eldersAndServants: {
                                    ...prev.additionalMeetings?.eldersAndServants,
                                    day: prev.additionalMeetings?.eldersAndServants?.day || '',
                                    time: e.target.value,
                                  },
                                },
                              }))
                            }
                          />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* REFEIÇÕES */}
                <div className="section refeicoes stretch" style={{ flex: 1.1, overflow: 'hidden' }}>
                  <div className="section-header">
                    <div className="section-icon">
                      <svg viewBox="0 0 24 24">
                        <path
                          d="M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z"
                          fill="white"
                        />
                      </svg>
                    </div>
                    <h2 className="refeicoes-header">
                      REFEIÇÕES{' '}
                      <input
                        type="text"
                        value={data.mealsHeaderTime || '(11:30)'}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          borderBottom: canEdit('circuitOverseerOnly') ? '1px dashed #c0392b' : 'none',
                          color: '#c0392b',
                          fontSize: '12px',
                          fontWeight: 800,
                          width: '60px',
                          outline: 'none',
                        }}
                        disabled={!canEdit('circuitOverseerOnly')}
                        onChange={(e) => update((prev) => ({ ...prev, mealsHeaderTime: e.target.value }))}
                      />
                    </h2>
                  </div>
                  <table style={{ height: 'calc(100% - 40px)' }}>
                    <thead>
                      <tr>
                        <th style={{ width: '22%' }}>DIA</th>
                        <th style={{ width: '33%' }}>ANFITRIÃO</th>
                        <th style={{ width: '45%' }}>ENDEREÇO / TELEFONE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.meals.map((row, idx) => (
                        <tr key={row.id || idx} style={{ height: `${100 / (data.meals.length || 1)}%` }}>
                          <td style={{ whiteSpace: 'nowrap' }}>{(row.day || '').replace(/0/g, 'o')}</td>
                          <td>
                            {row.isLodging ? (
                              <span style={{ fontWeight: 700, color: '#c0392b' }}>Hospedagem</span>
                            ) : (
                              <input
                                type="text"
                                className="editable-field"
                                value={row.host}
                                disabled={!canEdit('meals')}
                                onChange={(e) =>
                                  update((prev) => {
                                    const newRows = [...prev.meals];
                                    newRows[idx] = { ...newRows[idx], host: e.target.value };
                                    return { ...prev, meals: newRows };
                                  })
                                }
                              />
                            )}
                          </td>
                          <td>
                            {row.isLodging ? (
                              <span style={{ fontStyle: 'italic', color: '#777', fontSize: '9.5px' }}>
                                Almoço na Hospedagem
                              </span>
                            ) : (
                              <input
                                type="text"
                                className="editable-field"
                                value={row.addressPhone}
                                disabled={!canEdit('meals')}
                                onChange={(e) =>
                                  update((prev) => {
                                    const newRows = [...prev.meals];
                                    newRows[idx] = { ...newRows[idx], addressPhone: e.target.value };
                                    return { ...prev, meals: newRows };
                                  })
                                }
                              />
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            /* =========================================================================
               PÁGINA 2: PASTOREIO (ESPAÇO AMPLO PARA SITUAÇÃO) + PAUTA + RECOMENDAÇÕES E REMOÇÕES
               ========================================================================= */
            <div className="page confidential-page">
              {/* HEADER */}
              <div className="header">
                <div className="header-left">
                  <div className="header-icon">
                    <svg viewBox="0 0 24 24">
                      <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z" />
                    </svg>
                  </div>
                  <div className="header-title">
                    <div className="header-title-top">
                      <h1>PASTOREIO & PAUTA DOS ANCIÃOS</h1>
                      <span className="copy-owner-badge">{page.copyOwnerBadge}</span>
                    </div>
                    <p style={{ fontWeight: 600 }}>{page.headerSubtitle}</p>
                  </div>
                </div>
                <div className="confidential-stamp">
                  <span>USO CONFIDENCIAL</span>
                  <small>ANCIÃOS / VIAJANTE</small>
                </div>
              </div>

              {/* 1. VISITAS DE PASTOREIO (COM ESPAÇO AMPLO PARA MÚLTIPLAS LINHAS NA SITUAÇÃO) */}
              <div className="section pastoreio stretch" style={{ flex: 1.55, minHeight: 0 }}>
                <div className="section-header" style={{ justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div className="section-icon">
                      <svg viewBox="0 0 24 24">
                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                      </svg>
                    </div>
                    <h2>{page.pastoreioTitle}</h2>
                  </div>
                  <span className="section-hint">
                    Espaço amplo para detalhar a situação de cada família / publicador
                  </span>
                </div>

                <table className="pastoreio-detailed-table" style={{ flex: 1 }}>
                  <thead>
                    <tr>
                      <th style={{ width: '17%' }}>DIA / HORÁRIO</th>
                      <th style={{ width: '21%' }}>FAMÍLIA / PUBLICADOR</th>
                      <th style={{ width: '18%' }}>ACOMPANHANTE</th>
                      <th style={{ width: '44%' }}>SITUAÇÃO / MOTIVO DA VISITA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {page.pastoreioRows.map((row, idx) => (
                      <tr key={row.id || idx}>
                        <td className="pastoreio-cell-top">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                            <span className="day-icon">
                              <svg viewBox="0 0 24 24">
                                <path
                                  d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11z"
                                  fill="#aaa"
                                />
                              </svg>
                            </span>
                            <input
                              type="text"
                              className="editable-field"
                              style={{ fontWeight: 700 }}
                              value={row.dateTime}
                              disabled={!canEdit('shepherding')}
                              onChange={(e) => page.onPastoreioRowChange(idx, 'dateTime', e.target.value)}
                            />
                          </div>
                        </td>
                        <td className="pastoreio-cell-top">
                          <input
                            type="text"
                            className="editable-field"
                            style={{ fontWeight: 700 }}
                            value={row.family}
                            disabled={!canEdit('shepherding')}
                            onChange={(e) => page.onPastoreioRowChange(idx, 'family', e.target.value)}
                          />
                        </td>
                        <td className="pastoreio-cell-top">
                          <input
                            type="text"
                            className="editable-field"
                            value={row.companion}
                            disabled={!canEdit('shepherding')}
                            onChange={(e) => page.onPastoreioRowChange(idx, 'companion', e.target.value)}
                          />
                        </td>
                        <td className="pastoreio-situation-cell">
                          <textarea
                            className="editable-textarea"
                            rows={2}
                            placeholder={canEdit('shepherding') ? 'Descreva a situação ou motivo da visita...' : ''}
                            value={row.situation}
                            disabled={!canEdit('shepherding')}
                            onChange={(e) => page.onPastoreioRowChange(idx, 'situation', e.target.value)}
                          />
                          <div className="situation-print-mirror" aria-hidden="true">
                            {row.situation || '\u00A0'}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 2. SUGESTÕES DE ASSUNTOS PARA A PAUTA DA REUNIÃO DE ANCIÃOS */}
              <div className="section pauta-section stretch" style={{ flex: 0.9, minHeight: 0 }}>
                <div className="section-header" style={{ justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div className="section-icon" style={{ background: '#0f766e' }}>
                      <svg viewBox="0 0 24 24">
                        <path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm2 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
                      </svg>
                    </div>
                    <h2>SUGESTÕES DE ASSUNTOS PARA A PAUTA (REUNIÃO DE ANCIÃOS)</h2>
                  </div>
                  <span className="count-pill">
                    {suggestedTopics.length} {suggestedTopics.length === 1 ? 'assunto' : 'assuntos'}
                  </span>
                </div>

                <table className="agenda-subtable" style={{ flex: 1 }}>
                  <thead>
                    <tr>
                      <th style={{ width: '48%' }}>ASSUNTO / NECESSIDADE LOCAL</th>
                      <th style={{ width: '30%' }}>REFERÊNCIA / PUBLICAÇÃO</th>
                      <th style={{ width: '22%' }}>SUGERIDO POR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayTopics.map((topic, tIdx) => (
                      <tr key={topic.id || tIdx}>
                        <td style={{ fontWeight: topic.subject ? 700 : 400, color: '#1e293b' }}>
                          {topic.subject || <span className="empty-line" />}
                        </td>
                        <td style={{ color: '#475569' }}>
                          {topic.reference || <span className="empty-line" />}
                        </td>
                        <td style={{ color: '#475569' }}>
                          {topic.suggestedBy || <span className="empty-line" />}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 3. RECOMENDAÇÕES E REMOÇÕES (LADO A LADO) */}
              <div className="two-columns" style={{ flex: 1.05, minHeight: 0 }}>
                {/* RECOMENDAÇÕES (INDICAÇÕES) */}
                <div className="section rec-section stretch" style={{ flex: 1, minHeight: 0 }}>
                  <div className="section-header" style={{ justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className="section-icon" style={{ background: '#15803d' }}>
                        <svg viewBox="0 0 24 24">
                          <path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                        </svg>
                      </div>
                      <h2 style={{ color: '#15803d' }}>RECOMENDAÇÕES (INDICAÇÕES)</h2>
                    </div>
                    <span className="count-pill rec">
                      {recommendations.length}
                    </span>
                  </div>

                  <table className="agenda-subtable" style={{ flex: 1 }}>
                    <thead>
                      <tr>
                        <th style={{ width: '38%', background: '#f0fdf4', color: '#15803d' }}>IRMÃO</th>
                        <th style={{ width: '20%', background: '#f0fdf4', color: '#15803d' }}>CARGO</th>
                        <th style={{ width: '42%', background: '#f0fdf4', color: '#15803d' }}>OBSERVAÇÕES</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayRecommendations.map((rec, rIdx) => (
                        <tr key={rec.id || rIdx}>
                          <td style={{ fontWeight: rec.name ? 700 : 400, color: '#1e293b' }}>
                            {rec.name || <span className="empty-line" />}
                          </td>
                          <td>
                            {rec.name ? (
                              <span className={`role-tag ${rec.role === 'elder' ? 'elder' : 'servant'}`}>
                                {rec.role === 'elder' ? 'Ancião' : 'S. Min.'}
                              </span>
                            ) : (
                              <span className="empty-line" />
                            )}
                          </td>
                          <td style={{ fontSize: '9.5px', color: '#475569', whiteSpace: 'normal', lineHeight: 1.25 }}>
                            {rec.notes || <span className="empty-line" />}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* REMOÇÕES (DESQUALIFICAÇÕES / BAIXAS) */}
                <div className="section rem-section stretch" style={{ flex: 1, minHeight: 0 }}>
                  <div className="section-header" style={{ justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className="section-icon" style={{ background: '#b91c1c' }}>
                        <svg viewBox="0 0 24 24">
                          <path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2v2h8v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                        </svg>
                      </div>
                      <h2 style={{ color: '#b91c1c' }}>REMOÇÕES / BAIXAS</h2>
                    </div>
                    <span className="count-pill rem">
                      {removals.length}
                    </span>
                  </div>

                  <table className="agenda-subtable" style={{ flex: 1 }}>
                    <thead>
                      <tr>
                        <th style={{ width: '36%', background: '#fef2f2', color: '#b91c1c' }}>IRMÃO</th>
                        <th style={{ width: '20%', background: '#fef2f2', color: '#b91c1c' }}>CARGO</th>
                        <th style={{ width: '44%', background: '#fef2f2', color: '#b91c1c' }}>MOTIVO / OBS.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayRemovals.map((rem, remIdx) => (
                        <tr key={rem.id || remIdx}>
                          <td style={{ fontWeight: rem.name ? 700 : 400, color: '#1e293b' }}>
                            {rem.name || <span className="empty-line" />}
                          </td>
                          <td>
                            {rem.name ? (
                              <span className={`role-tag ${rem.role === 'elder' ? 'elder' : 'servant'}`}>
                                {rem.role === 'elder' ? 'Ancião' : 'S. Min.'}
                              </span>
                            ) : (
                              <span className="empty-line" />
                            )}
                          </td>
                          <td style={{ fontSize: '9.5px', color: '#475569', whiteSpace: 'normal', lineHeight: 1.25 }}>
                            {rem.reason || <span className="empty-line" />}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* ESTILOS CSS MULTI-PÁGINA EXATOS E COMPATÍVEIS COM IMPRESSÃO */}
      <style jsx>{`
        .semana-visita-wrapper {
          font-family: 'Roboto', Arial, sans-serif;
          background: transparent;
          color: #333;
          padding: 16px 8px 40px 8px;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 20px;
          width: max-content;
          min-width: 100%;
          box-sizing: border-box;
        }

        .print-bar {
          width: 210mm;
          margin: 0 auto;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
        }

        .print-bar-info {
          font-size: 13px;
          color: #475569;
          font-weight: 500;
        }

        .print-bar-info strong {
          color: #1a5c5a;
        }

        .btn-print {
          display: flex;
          align-items: center;
          gap: 8px;
          background: linear-gradient(135deg, #1a5c5a, #1d7a77);
          color: white;
          border: none;
          border-radius: 10px;
          padding: 10px 22px;
          font-size: 13px;
          font-weight: 700;
          font-family: inherit;
          cursor: pointer;
          box-shadow: 0 3px 10px rgba(26, 92, 90, 0.35);
          letter-spacing: 0.5px;
          transition: all 0.2s ease;
        }

        .btn-print:hover {
          background: linear-gradient(135deg, #155250, #1a6b68);
          box-shadow: 0 5px 16px rgba(26, 92, 90, 0.45);
          transform: translateY(-1px);
        }

        .btn-print svg {
          width: 18px;
          height: 18px;
          fill: white;
          flex-shrink: 0;
        }

        .page-wrapper {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin: 0 auto;
        }

        .page-indicator {
          width: 210mm;
          margin-bottom: 6px;
          font-size: 11.5px;
          font-weight: 800;
          color: #1a5c5a;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0 4px;
        }

        .page-indicator-counter {
          font-size: 11px;
          font-weight: 600;
          color: #64748b;
          background: #e2e8f0;
          padding: 2px 8px;
          border-radius: 12px;
        }

        .page {
          width: 210mm;
          height: 297mm;
          margin: 0 auto;
          background: white;
          padding: 7mm;
          box-shadow: 0 2px 14px rgba(0, 0, 0, 0.12);
          display: flex;
          flex-direction: column;
          gap: 6px;
          box-sizing: border-box;
        }

        .header {
          background: linear-gradient(135deg, #1a5c5a 0%, #1b6b68 50%, #1d7a77 100%);
          border-radius: 12px;
          padding: 10px 18px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          color: white;
          flex-shrink: 0;
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .header-icon {
          width: 46px;
          height: 46px;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .header-icon svg {
          width: 27px;
          height: 27px;
          fill: white;
        }

        .header-title-top {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .header-title h1 {
          font-size: 19px;
          font-weight: 900;
          letter-spacing: 0.8px;
          margin: 0;
        }

        .copy-owner-badge {
          background: rgba(255, 255, 255, 0.22);
          border: 1px solid rgba(255, 255, 255, 0.5);
          color: white;
          font-size: 9.5px;
          font-weight: 800;
          padding: 2px 9px;
          border-radius: 999px;
          letter-spacing: 0.6px;
          text-transform: uppercase;
          white-space: nowrap;
        }

        .header-title p {
          font-size: 12px;
          opacity: 0.92;
          margin-top: 2px;
          margin-bottom: 0;
        }

        .header-title p input {
          background: transparent;
          border: none;
          border-bottom: 1px dashed rgba(255, 255, 255, 0.5);
          color: white;
          font-size: 12px;
          font-family: inherit;
          width: 240px;
          outline: none;
        }

        .confidential-stamp {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          background: rgba(0, 0, 0, 0.18);
          border: 1px solid rgba(255, 255, 255, 0.35);
          padding: 4px 10px;
          border-radius: 8px;
          text-align: right;
        }

        .confidential-stamp span {
          font-size: 9.5px;
          font-weight: 900;
          letter-spacing: 0.8px;
        }

        .confidential-stamp small {
          font-size: 8px;
          opacity: 0.85;
          font-weight: 600;
        }

        .header-days {
          display: flex;
          gap: 10px;
        }

        .header-day {
          text-align: center;
        }

        .header-day label {
          display: block;
          font-size: 10px;
          font-weight: 700;
          margin-bottom: 4px;
        }

        .header-day input[type='checkbox'] {
          -webkit-appearance: none;
          appearance: none;
          width: 21px;
          height: 21px;
          border: 2px solid rgba(255, 255, 255, 0.7);
          border-radius: 50%;
          background: transparent;
          cursor: pointer;
          position: relative;
        }

        .header-day input[type='checkbox']:checked {
          background: white;
        }

        .header-day input[type='checkbox']:checked::after {
          content: '✓';
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          color: #1a5c5a;
          font-weight: 900;
          font-size: 12px;
        }

        .two-columns {
          display: flex;
          gap: 6px;
          min-height: 0;
        }

        .row-fixed {
          display: flex;
          gap: 6px;
          min-height: 0;
        }

        .section {
          background: white;
          border-radius: 10px;
          padding: 9px 13px;
          border: 1px solid #e0ddd8;
          overflow: hidden;
        }

        .section.stretch {
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow: hidden;
        }

        .section.stretch table {
          flex: 1;
        }

        .section.stretch tbody {
          height: 100%;
        }

        .section-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 6px;
          flex-shrink: 0;
        }

        .section-hint {
          font-size: 9.5px;
          color: #64748b;
          font-style: italic;
        }

        .count-pill {
          font-size: 9.5px;
          font-weight: 800;
          background: #f0fdfa;
          color: #0f766e;
          border: 1px solid #99f6e4;
          padding: 2px 8px;
          border-radius: 999px;
          text-transform: uppercase;
        }

        .count-pill.rec {
          background: #f0fdf4;
          color: #15803d;
          border-color: #bbf7d0;
        }

        .count-pill.rem {
          background: #fef2f2;
          color: #b91c1c;
          border-color: #fecaca;
        }

        .section-icon {
          width: 30px;
          height: 30px;
          background: #1a5c5a;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .section-icon svg {
          width: 16px;
          height: 16px;
          fill: white;
        }

        .section-header h2 {
          font-size: 12px;
          font-weight: 800;
          color: #1a5c5a;
          letter-spacing: 0.4px;
          margin: 0;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }

        table thead th {
          background: #f0edea;
          color: #555;
          font-size: 8.5px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.6px;
          padding: 4px 6px;
          text-align: left;
          border-bottom: 1px solid #ddd;
          white-space: nowrap;
          overflow: hidden;
        }

        table tbody td {
          padding: 2px 6px;
          border-bottom: 1px solid #eee;
          font-size: 10px;
          vertical-align: middle;
          overflow: hidden;
        }

        table tbody tr:last-child td {
          border-bottom: none;
        }

        .editable-field {
          border: none;
          border-bottom: 1px solid #ccc;
          background: transparent;
          font-family: inherit;
          font-size: 10px;
          width: 100%;
          padding: 2px 0;
          outline: none;
          color: #333;
        }

        .editable-field:focus {
          border-bottom-color: #1a5c5a;
        }

        .editable-field:disabled {
          color: #333;
          border-bottom: 1px solid #ccc;
        }

        /* TABELA DETALHADA DE PASTOREIO (PÁGINA 2) COM SUPORTE A MÚLTIPLAS LINHAS */
        .pastoreio-detailed-table tbody td {
          padding: 5px 6px;
          border-bottom: 1px solid #e2e8f0;
          vertical-align: top;
        }

        .pastoreio-cell-top {
          padding-top: 7px !important;
        }

        .pastoreio-situation-cell {
          position: relative;
        }

        .editable-textarea {
          width: 100%;
          min-height: 36px;
          height: 100%;
          border: 1px dashed #cbd5e1;
          border-radius: 6px;
          background: #f8fafc;
          font-family: inherit;
          font-size: 10px;
          line-height: 1.35;
          color: #1e293b;
          padding: 4px 6px;
          resize: none;
          outline: none;
          box-sizing: border-box;
          white-space: pre-wrap;
          word-break: break-word;
        }

        .editable-textarea:focus {
          border-color: #1a5c5a;
          background: #ffffff;
        }

        .editable-textarea:disabled {
          background: transparent;
          border: none;
          border-bottom: 1px solid #e2e8f0;
          border-radius: 0;
          padding: 2px 0;
        }

        .situation-print-mirror {
          display: none;
          font-size: 10px;
          line-height: 1.35;
          color: #1e293b;
          white-space: pre-wrap;
          word-break: break-word;
          min-height: 32px;
        }

        .agenda-subtable tbody td {
          padding: 4px 6px;
          font-size: 10px;
          border-bottom: 1px solid #f1f5f9;
        }

        .empty-line {
          display: block;
          width: 100%;
          height: 12px;
          border-bottom: 1px dashed #cbd5e1;
        }

        .role-tag {
          display: inline-block;
          font-size: 8.5px;
          font-weight: 800;
          padding: 1.5px 6px;
          border-radius: 4px;
          text-transform: uppercase;
        }

        .role-tag.elder {
          background: #e0f2fe;
          color: #0369a1;
        }

        .role-tag.servant {
          background: #fef3c7;
          color: #b45309;
        }

        .day-icon {
          display: inline-block;
          margin-right: 2px;
          vertical-align: middle;
          flex-shrink: 0;
        }

        .day-icon svg {
          width: 11px;
          height: 11px;
          fill: #888;
        }

        .name-badge {
          display: block;
          width: 100%;
          background: #1a5c5a;
          color: white;
          font-size: 9.5px;
          font-weight: 800;
          padding: 3px 10px 4px 10px;
          border-radius: 5px;
          margin-bottom: 3px;
          letter-spacing: 0.5px;
          box-sizing: border-box;
        }

        .name-badge-sizer {
          display: inline-grid;
          align-items: center;
          border-bottom: 2.5px solid white;
          padding-bottom: 1px;
        }

        .name-badge-mirror,
        .name-badge-sizer input {
          grid-area: 1 / 1 / 2 / 2;
          font-size: 9.5px;
          font-weight: 800;
          font-family: inherit;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          padding: 0;
          margin: 0;
        }

        .name-badge-mirror {
          visibility: hidden;
          white-space: pre;
          pointer-events: none;
        }

        .name-badge-sizer input {
          background: transparent;
          border: none !important;
          color: white;
          width: 100%;
          min-width: 1ch;
          outline: none;
        }

        .meeting-row {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 0;
          border-bottom: 1px solid #eee;
          flex-wrap: wrap;
          flex-shrink: 0;
        }

        .meeting-label {
          font-size: 9.5px;
          font-weight: 800;
          color: #1a5c5a;
          letter-spacing: 0.3px;
        }

        .meeting-field-group {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .meeting-field-label {
          font-size: 9.5px;
          font-weight: 700;
          color: #666;
        }

        .meeting-input {
          border: none;
          border-bottom: 1px solid #ccc;
          background: transparent;
          font-family: inherit;
          font-size: 10.5px;
          font-weight: 600;
          padding: 1px 4px;
          outline: none;
          color: #1a5c5a;
        }

        .meeting-input:focus {
          border-bottom-color: #1a5c5a;
        }

        .meeting-input:disabled {
          color: #1a5c5a;
          border-bottom: 1px solid #ccc;
        }

        .meeting-input.small {
          width: 65px;
          text-align: center;
        }

        .horario-badge {
          display: flex;
          align-items: center;
          gap: 4px;
          background: #e8f4f3;
          border: 1px solid #b2dfdb;
          border-radius: 4px;
          padding: 2px 7px;
        }

        .horario-badge .meeting-field-label {
          color: #1a5c5a;
          font-weight: 700;
          font-size: 9.5px;
        }

        .horario-badge .meeting-input {
          border-bottom-color: #1a5c5a;
          color: #1a5c5a;
          font-weight: 700;
        }

        .day-checkbox-group {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .day-check-item {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .day-check-item label {
          font-size: 10.5px;
          font-weight: 700;
          color: #444;
          cursor: pointer;
        }

        .day-check-item input[type='checkbox'] {
          -webkit-appearance: none;
          appearance: none;
          width: 14px;
          height: 14px;
          border: 1.5px solid #888;
          border-radius: 3px;
          background: white;
          cursor: pointer;
          position: relative;
        }

        .day-check-item input[type='checkbox']:checked {
          background: #1a5c5a;
          border-color: #1a5c5a;
        }

        .day-check-item input[type='checkbox']:checked::after {
          content: '✓';
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          color: white;
          font-weight: 900;
          font-size: 9px;
        }

        .meeting-row-container {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
        }

        .meeting-row-left {
          display: flex;
          align-items: center;
          gap: 7px;
          flex: 1;
        }

        .meeting-row-right {
          display: flex;
          align-items: center;
          gap: 7px;
        }

        .info-section-divider {
          border: none;
          border-top: 1px solid #e0ddd8;
          margin: 4px 0;
        }

        .reuniao-icon {
          display: inline-block;
          margin-right: 3px;
          vertical-align: middle;
        }

        .reuniao-icon svg {
          width: 14px;
          height: 14px;
          fill: #888;
        }

        .section.refeicoes .section-icon {
          background: #c0392b;
        }

        .section.refeicoes table thead th {
          background: #fdecea;
          color: #c0392b;
        }

        .refeicoes-header {
          color: #c0392b !important;
          margin: 0;
        }

        .section.refeicoes tbody td {
          padding-top: 2px;
          padding-bottom: 2px;
          height: auto;
        }

        .section.pastoreio .section-icon {
          background: #1a5c5a;
        }

        .section.pastoreio table thead th {
          background: #e8f5f4;
          color: #1a5c5a;
        }

        .section.adicionais tbody td {
          padding-top: 6px;
          padding-bottom: 6px;
        }

        @media print {
          .print-bar,
          .page-indicator,
          .section-hint {
            display: none !important;
          }

          .editable-textarea {
            display: none !important;
          }

          .situation-print-mirror {
            display: block !important;
          }

          body {
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .semana-visita-wrapper {
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
            gap: 0 !important;
            display: block !important;
          }

          .page-wrapper {
            margin: 0 !important;
            padding: 0 !important;
            display: block !important;
            page-break-after: always !important;
            break-after: page !important;
          }

          .page-wrapper:last-child {
            page-break-after: avoid !important;
            break-after: avoid !important;
          }

          .page {
            margin: 0 !important;
            padding: 7mm !important;
            background: white !important;
            box-shadow: none !important;
            width: 210mm !important;
            height: 296mm !important;
            max-height: 296mm !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          input {
            border-bottom-style: solid !important;
          }

          @page {
            size: A4 portrait;
            margin: 0mm;
          }
        }
      `}</style>
    </div>
  );
}
