'use client';

import React from 'react';
import { VisitSchedule, StudyVisitRow, ShepherdingRow } from '@/types/visitSchedule';

interface SemanaVisitaPrintProps {
  data: VisitSchedule;
  onChange?: (updated: VisitSchedule) => void;
  isReadOnly?: boolean;
  elderMode?: boolean;
  filterRole?: 'all' | 'esposa' | 'viajante';
}

interface PrintPageDefinition {
  pageId: string;
  pageNumber: number;
  label: string;
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
  // Pastoreio
  hasPastoreio: boolean;
  pastoreioTitle?: string;
  pastoreioRows?: ShepherdingRow[];
  onPastoreioRowChange?: (idx: number, field: keyof ShepherdingRow, val: string) => void;
}

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

  const canEdit = (fieldKey: 'midweekMeeting' | 'weekendMeeting' | 'fieldService' | 'meals' | 'shepherding' | 'studies' | 'additionalMeetings' | 'circuitOverseerOnly') => {
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
      case 'circuitOverseerOnly':
        return false;
      default:
        return false;
    }
  };

  // Construir a lista de páginas
  // 1. Página 1: Viajante / Marido (com estudos de ambos e com pastoreio)
  // 2. Página 2: Esposa (com estudos de ambos para saber os estudos do cônjuge, mas sem pastoreio)
  // 3. Páginas 3+: Acompanhante(s) (com estudos de ambos se casado, pastoreio opcional, e se casado página 4 sem pastoreio)
  const pages: PrintPageDefinition[] = [];
  let currentPageNum = 1;

  // PÁGINA 1: MARIDO / VIAJANTE
  pages.push({
    pageId: 'viajante',
    pageNumber: currentPageNum++,
    label: `Página 1: Viajante (${data.studiesAndVisits.husbandName || 'Marido'})`,
    headerSubtitle: data.coupleNames || '',
    isSubtitleEditable: true,
    onSubtitleChange: (val) => update((prev) => ({ ...prev, coupleNames: val })),
    // Marido
    primaryBadgeName: data.studiesAndVisits.husbandName || 'VIAJANTE',
    isPrimaryBadgeEditable: true,
    onPrimaryBadgeChange: (val) => update((prev) => ({
      ...prev,
      studiesAndVisits: { ...prev.studiesAndVisits, husbandName: val },
    })),
    primaryStudyRows: data.studiesAndVisits.husbandRows || [],
    onPrimaryStudyRowChange: (idx, field, val) => update((prev) => {
      const updated = [...prev.studiesAndVisits.husbandRows];
      updated[idx] = { ...updated[idx], [field]: val };
      return { ...prev, studiesAndVisits: { ...prev.studiesAndVisits, husbandRows: updated } };
    }),
    // Esposa (para que ambos saibam os estudos do cônjuge)
    hasSpouse: true,
    spouseBadgeName: data.studiesAndVisits.wifeName || 'ESPOSA',
    isSpouseBadgeEditable: true,
    onSpouseBadgeChange: (val) => update((prev) => ({
      ...prev,
      studiesAndVisits: { ...prev.studiesAndVisits, wifeName: val },
    })),
    spouseStudyRows: data.studiesAndVisits.wifeRows || [],
    onSpouseStudyRowChange: (idx, field, val) => update((prev) => {
      const updated = [...prev.studiesAndVisits.wifeRows];
      updated[idx] = { ...updated[idx], [field]: val };
      return { ...prev, studiesAndVisits: { ...prev.studiesAndVisits, wifeRows: updated } };
    }),
    hasPastoreio: true,
    pastoreioTitle: 'VISITAS DE PASTOREIO',
    pastoreioRows: data.shepherding || [],
    onPastoreioRowChange: (idx, field, val) => update((prev) => {
      const updated = [...prev.shepherding];
      updated[idx] = { ...updated[idx], [field]: val };
      return { ...prev, shepherding: updated };
    }),
  });

  // PÁGINA 2: ESPOSA (Sem pastoreio embaixo, com estudos de ambos)
  pages.push({
    pageId: 'esposa',
    pageNumber: currentPageNum++,
    label: `Página 2: Esposa (${data.studiesAndVisits.wifeName || 'Esposa'})`,
    headerSubtitle: data.coupleNames || '',
    isSubtitleEditable: true,
    onSubtitleChange: (val) => update((prev) => ({ ...prev, coupleNames: val })),
    // Marido
    primaryBadgeName: data.studiesAndVisits.husbandName || 'VIAJANTE',
    isPrimaryBadgeEditable: true,
    onPrimaryBadgeChange: (val) => update((prev) => ({
      ...prev,
      studiesAndVisits: { ...prev.studiesAndVisits, husbandName: val },
    })),
    primaryStudyRows: data.studiesAndVisits.husbandRows || [],
    onPrimaryStudyRowChange: (idx, field, val) => update((prev) => {
      const updated = [...prev.studiesAndVisits.husbandRows];
      updated[idx] = { ...updated[idx], [field]: val };
      return { ...prev, studiesAndVisits: { ...prev.studiesAndVisits, husbandRows: updated } };
    }),
    // Esposa
    hasSpouse: true,
    spouseBadgeName: data.studiesAndVisits.wifeName || 'ESPOSA',
    isSpouseBadgeEditable: true,
    onSpouseBadgeChange: (val) => update((prev) => ({
      ...prev,
      studiesAndVisits: { ...prev.studiesAndVisits, wifeName: val },
    })),
    spouseStudyRows: data.studiesAndVisits.wifeRows || [],
    onSpouseStudyRowChange: (idx, field, val) => update((prev) => {
      const updated = [...prev.studiesAndVisits.wifeRows];
      updated[idx] = { ...updated[idx], [field]: val };
      return { ...prev, studiesAndVisits: { ...prev.studiesAndVisits, wifeRows: updated } };
    }),
    hasPastoreio: false,
  });

  // PÁGINAS DO(S) ACOMPANHANTE(S)
  (data.studiesAndVisits.companions || []).forEach((comp, compIdx) => {
    const compPageNum = currentPageNum++;
    const compHasShepherding = !!(comp.hasShepherding && comp.shepherding && comp.shepherding.length > 0);

    // Página do Irmão Acompanhante
    pages.push({
      pageId: `companion-${comp.id || compIdx}`,
      pageNumber: compPageNum,
      label: `Página ${compPageNum}: Acompanhante (${comp.name || 'Irmão'})`,
      headerSubtitle: comp.name 
        ? (data.coupleNames ? `${data.coupleNames} — Acompanhante: ${comp.name}` : `Acompanhante: ${comp.name}`)
        : (data.coupleNames || 'Acompanhante'),
      isSubtitleEditable: false,
      primaryBadgeName: comp.name || 'ACOMPANHANTE',
      isPrimaryBadgeEditable: true,
      onPrimaryBadgeChange: (val) => update((prev) => {
        const comps = [...(prev.studiesAndVisits.companions || [])];
        comps[compIdx] = { ...comps[compIdx], name: val };
        return { ...prev, studiesAndVisits: { ...prev.studiesAndVisits, companions: comps } };
      }),
      primaryStudyRows: comp.rows || [],
      onPrimaryStudyRowChange: (idx, field, val) => update((prev) => {
        const comps = [...(prev.studiesAndVisits.companions || [])];
        const updatedRows = [...comps[compIdx].rows];
        updatedRows[idx] = { ...updatedRows[idx], [field]: val };
        comps[compIdx] = { ...comps[compIdx], rows: updatedRows };
        return { ...prev, studiesAndVisits: { ...prev.studiesAndVisits, companions: comps } };
      }),
      // Se casado, também mostra os estudos da esposa dele
      hasSpouse: !!comp.hasWife,
      spouseBadgeName: comp.wifeName || 'ESPOSA',
      isSpouseBadgeEditable: true,
      onSpouseBadgeChange: (val) => update((prev) => {
        const comps = [...(prev.studiesAndVisits.companions || [])];
        comps[compIdx] = { ...comps[compIdx], wifeName: val };
        return { ...prev, studiesAndVisits: { ...prev.studiesAndVisits, companions: comps } };
      }),
      spouseStudyRows: comp.wifeRows || [],
      onSpouseStudyRowChange: (idx, field, val) => update((prev) => {
        const comps = [...(prev.studiesAndVisits.companions || [])];
        const updatedRows = [...(comps[compIdx].wifeRows || [])];
        updatedRows[idx] = { ...updatedRows[idx], [field]: val };
        comps[compIdx] = { ...comps[compIdx], wifeRows: updatedRows };
        return { ...prev, studiesAndVisits: { ...prev.studiesAndVisits, companions: comps } };
      }),
      hasPastoreio: compHasShepherding,
      pastoreioTitle: `VISITAS DE PASTOREIO (${comp.name || 'ACOMPANHANTE'})`,
      pastoreioRows: comp.shepherding || [],
      onPastoreioRowChange: (idx, field, val) => update((prev) => {
        const comps = [...(prev.studiesAndVisits.companions || [])];
        const updatedSh = [...(comps[compIdx].shepherding || [])];
        updatedSh[idx] = { ...updatedSh[idx], [field]: val };
        comps[compIdx] = { ...comps[compIdx], shepherding: updatedSh };
        return { ...prev, studiesAndVisits: { ...prev.studiesAndVisits, companions: comps } };
      }),
    });

    // Página da Esposa do Acompanhante (se casado)
    if (comp.hasWife) {
      const wifePageNum = currentPageNum++;
      pages.push({
        pageId: `companion-wife-${comp.id || compIdx}`,
        pageNumber: wifePageNum,
        label: `Página ${wifePageNum}: Esposa do Acompanhante (${comp.wifeName || 'Esposa'})`,
        headerSubtitle: comp.wifeName
          ? (data.coupleNames ? `${data.coupleNames} — Esposa do Acompanhante: ${comp.wifeName}` : `Esposa do Acompanhante: ${comp.wifeName}`)
          : (data.coupleNames || 'Esposa do Acompanhante'),
        isSubtitleEditable: false,
        primaryBadgeName: comp.name || 'ACOMPANHANTE',
        isPrimaryBadgeEditable: true,
        onPrimaryBadgeChange: (val) => update((prev) => {
          const comps = [...(prev.studiesAndVisits.companions || [])];
          comps[compIdx] = { ...comps[compIdx], name: val };
          return { ...prev, studiesAndVisits: { ...prev.studiesAndVisits, companions: comps } };
        }),
        primaryStudyRows: comp.rows || [],
        onPrimaryStudyRowChange: (idx, field, val) => update((prev) => {
          const comps = [...(prev.studiesAndVisits.companions || [])];
          const updatedRows = [...comps[compIdx].rows];
          updatedRows[idx] = { ...updatedRows[idx], [field]: val };
          comps[compIdx] = { ...comps[compIdx], rows: updatedRows };
          return { ...prev, studiesAndVisits: { ...prev.studiesAndVisits, companions: comps } };
        }),
        hasSpouse: true,
        spouseBadgeName: comp.wifeName || 'ESPOSA',
        isSpouseBadgeEditable: true,
        onSpouseBadgeChange: (val) => update((prev) => {
          const comps = [...(prev.studiesAndVisits.companions || [])];
          comps[compIdx] = { ...comps[compIdx], wifeName: val };
          return { ...prev, studiesAndVisits: { ...prev.studiesAndVisits, companions: comps } };
        }),
        spouseStudyRows: comp.wifeRows || [],
        onSpouseStudyRowChange: (idx, field, val) => update((prev) => {
          const comps = [...(prev.studiesAndVisits.companions || [])];
          const updatedRows = [...(comps[compIdx].wifeRows || [])];
          updatedRows[idx] = { ...updatedRows[idx], [field]: val };
          comps[compIdx] = { ...comps[compIdx], wifeRows: updatedRows };
          return { ...prev, studiesAndVisits: { ...prev.studiesAndVisits, companions: comps } };
        }),
        hasPastoreio: false,
      });
    }
  });

  const renderedPages = filterRole === 'esposa'
    ? pages.filter((p) => p.pageId === 'esposa' || p.pageId.startsWith('companion-wife'))
    : filterRole === 'viajante'
    ? pages.filter((p) => p.pageId === 'viajante' || (p.pageId.startsWith('companion-') && !p.pageId.startsWith('companion-wife')))
    : pages;

  return (
    <div className="semana-visita-wrapper">
      {/* BARRA DE IMPRESSÃO */}
      <div className="print-bar">
        <div className="print-bar-info">
          <span>Programação da Semana da Visita — <strong>{renderedPages.length} {renderedPages.length === 1 ? 'página' : 'páginas'} para impressão</strong></span>
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
            <span className="page-indicator-counter">Página {index + 1} de {renderedPages.length}</span>
          </div>

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
                  <h1>SEMANA DA VISITA</h1>
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
            <div className="two-columns" style={{ flex: page.hasPastoreio ? 2.2 : 2.8, minHeight: 0 }}>
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

              {/* ESTUDOS E REVISITAS (MOSTRA AMBOS OS CÔNJUGES PARA QUE O CASAL SAIBA OS ESTUDOS DO OUTRO) */}
              <div className="section stretch" style={{ overflow: 'hidden' }}>
                <div className="section-header">
                  <div className="section-icon">
                    <svg viewBox="0 0 24 24">
                      <path d="M21 5c-1.11-.35-2.33-.5-3.5-.5-1.95 0-4.05.4-5.5 1.5-1.45-1.1-3.55-1.5-5.5-1.5S2.45 4.9 1 6v14.65c0 .25.25.5.5.5.1 0 .15-.05.25-.05C3.1 20.45 5.05 20 6.5 20c1.95 0 4.05.4 5.5 1.5 1.35-.85 3.8-1.5 5.5-1.5 1.65 0 3.35.3 4.75 1.05.1.05.15.05.25.05.25 0 .5-.25.5-.5V6c-.6-.45-1.25-.75-2-1zm0 13.5c-1.1-.35-2.3-.5-3.5-.5-1.7 0-4.15.65-5.5 1.5V8c1.35-.85 3.8-1.5 5.5-1.5 1.2 0 2.4.15 3.5.5v11.5z" />
                    </svg>
                  </div>
                  <h2>ESTUDOS E REVISITAS</h2>
                </div>

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '5px', minHeight: 0, overflow: 'hidden' }}>
                  {/* PRIMEIRO CÔNJUGE (MARIDO / VIAJANTE / IRMÃO) */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                    <div className="name-badge">
                      <input
                        type="text"
                        value={page.primaryBadgeName}
                        disabled={!page.isPrimaryBadgeEditable || !canEdit('circuitOverseerOnly')}
                        onChange={(e) => page.onPrimaryBadgeChange && page.onPrimaryBadgeChange(e.target.value)}
                      />
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
                        <input
                          type="text"
                          value={page.spouseBadgeName || 'ESPOSA'}
                          disabled={!page.isSpouseBadgeEditable || !canEdit('circuitOverseerOnly')}
                          onChange={(e) => page.onSpouseBadgeChange && page.onSpouseBadgeChange(e.target.value)}
                        />
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
                                  onChange={(e) => page.onSpouseStudyRowChange && page.onSpouseStudyRowChange(idx, 'day', e.target.value)}
                                />
                              </td>
                              <td>
                                <input
                                  type="text"
                                  className="editable-field"
                                  value={row.time}
                                  disabled={!canEdit('circuitOverseerOnly')}
                                  onChange={(e) => page.onSpouseStudyRowChange && page.onSpouseStudyRowChange(idx, 'time', e.target.value)}
                                />
                              </td>
                              <td>
                                <input
                                  type="text"
                                  className="editable-field"
                                  value={row.companionPhone}
                                  disabled={!canEdit('studies')}
                                  onChange={(e) => page.onSpouseStudyRowChange && page.onSpouseStudyRowChange(idx, 'companionPhone', e.target.value)}
                                />
                              </td>
                              <td>
                                <input
                                  type="text"
                                  className="editable-field"
                                  value={row.lesson}
                                  disabled={!canEdit('studies')}
                                  onChange={(e) => page.onSpouseStudyRowChange && page.onSpouseStudyRowChange(idx, 'lesson', e.target.value)}
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
            <div className="row-fixed" style={{ flex: page.hasPastoreio ? 1.4 : 1.7, minHeight: 0 }}>
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
                                  ...prev.additionalMeetings,
                                  eldersAndServants: {
                                    day: e.target.value,
                                    time: prev.additionalMeetings?.eldersAndServants?.time || '',
                                  },
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
                                  ...prev.additionalMeetings,
                                  eldersAndServants: {
                                    day: prev.additionalMeetings?.eldersAndServants?.day || '',
                                    time: e.target.value,
                                  },
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
                      <th style={{ width: '18%' }}>DIA</th>
                      <th style={{ width: '35%' }}>ANFITRIÃO</th>
                      <th style={{ width: '47%' }}>ENDEREÇO / TELEFONE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.meals.map((row, idx) => (
                      <tr key={row.id || idx} style={{ height: `${100 / (data.meals.length || 1)}%` }}>
                        <td>{row.day}</td>
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

            {/* VISITAS DE PASTOREIO (RENDERIZADO CONDICIONALMENTE SE hasPastoreio FOR TRUE) */}
            {page.hasPastoreio && page.pastoreioRows && (
              <div className="section pastoreio stretch" style={{ flex: 0.9, minHeight: 0, overflow: 'hidden' }}>
                <div className="section-header">
                  <div className="section-icon">
                    <svg viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                    </svg>
                  </div>
                  <h2>{page.pastoreioTitle || 'VISITAS DE PASTOREIO'}</h2>
                </div>
                <table style={{ height: 'calc(100% - 40px)' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '20%' }}>DIA / HORÁRIO</th>
                      <th style={{ width: '20%' }}>FAMÍLIA</th>
                      <th style={{ width: '20%' }}>ACOMPANHANTE</th>
                      <th style={{ width: '45%' }}>SITUAÇÃO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {page.pastoreioRows.map((row, idx) => (
                      <tr key={row.id || idx} style={{ height: '50%' }}>
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
                            style={{ width: '80%' }}
                            value={row.dateTime}
                            disabled={!canEdit('shepherding')}
                            onChange={(e) =>
                              page.onPastoreioRowChange &&
                              page.onPastoreioRowChange(idx, 'dateTime', e.target.value)
                            }
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className="editable-field"
                            value={row.family}
                            disabled={!canEdit('shepherding')}
                            onChange={(e) =>
                              page.onPastoreioRowChange &&
                              page.onPastoreioRowChange(idx, 'family', e.target.value)
                            }
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className="editable-field"
                            value={row.companion}
                            disabled={!canEdit('shepherding')}
                            onChange={(e) =>
                              page.onPastoreioRowChange &&
                              page.onPastoreioRowChange(idx, 'companion', e.target.value)
                            }
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className="editable-field"
                            value={row.situation}
                            disabled={!canEdit('shepherding')}
                            onChange={(e) =>
                              page.onPastoreioRowChange &&
                              page.onPastoreioRowChange(idx, 'situation', e.target.value)
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
      ))}

      {/* ESTILOS CSS MULTI-PÁGINA EXATOS E COMPATÍVEIS COM IMPRESSÃO */}
      <style jsx>{`
        .semana-visita-wrapper {
          font-family: 'Roboto', Arial, sans-serif;
          background: transparent;
          color: #333;
          padding: 16px 0 40px 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 20px;
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
          gap: 5px;
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

        .header-title h1 {
          font-size: 20px;
          font-weight: 900;
          letter-spacing: 1px;
          margin: 0;
        }

        .header-title p {
          font-size: 12px;
          opacity: 0.9;
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
          gap: 5px;
          min-height: 0;
        }

        .row-fixed {
          display: flex;
          gap: 5px;
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

        .section-icon {
          width: 32px;
          height: 32px;
          background: #1a5c5a;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .section-icon svg {
          width: 17px;
          height: 17px;
          fill: white;
        }

        .section-header h2 {
          font-size: 12.5px;
          font-weight: 800;
          color: #1a5c5a;
          letter-spacing: 0.5px;
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
          padding: 3px 5px;
          text-align: left;
          border-bottom: 1px solid #ddd;
          white-space: nowrap;
          overflow: hidden;
        }

        table tbody td {
          padding: 1px 5px;
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
          padding: 1px 0;
          outline: none;
          color: #333;
        }

        .editable-field:focus {
          border-bottom-color: #1a5c5a;
        }

        .editable-field:disabled {
          color: #333;
          border-bottom: 1px solid transparent;
        }

        .day-icon {
          display: inline-block;
          margin-right: 2px;
          vertical-align: middle;
        }

        .day-icon svg {
          width: 11px;
          height: 11px;
          fill: #888;
        }

        .name-badge {
          display: inline-block;
          background: #1a5c5a;
          color: white;
          font-size: 9px;
          font-weight: 700;
          padding: 2px 9px;
          border-radius: 4px;
          margin-bottom: 3px;
          letter-spacing: 0.5px;
          vertical-align: top;
        }

        .name-badge input {
          background: transparent;
          border: none;
          color: white;
          font-size: 9px;
          font-weight: 700;
          font-family: inherit;
          width: 120px;
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
          font-weight: 700;
          color: #444;
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
          padding: 1px 4px;
          outline: none;
          color: #333;
        }

        .meeting-input:focus {
          border-bottom-color: #1a5c5a;
        }

        .meeting-input:disabled {
          color: #333;
          border-bottom: 1px solid transparent;
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

        .section.pastoreio tbody td {
          padding-top: 3px;
          padding-bottom: 3px;
          height: auto;
        }

        .section.adicionais tbody td {
          padding-top: 6px;
          padding-bottom: 6px;
        }

        @media print {
          .print-bar,
          .page-indicator {
            display: none !important;
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
