'use client';

import React from 'react';
import { VisitSchedule } from '@/types/visitSchedule';

interface SemanaVisitaPrintProps {
  data: VisitSchedule;
  onChange?: (updated: VisitSchedule) => void;
  isReadOnly?: boolean;
  // Permissões específicas quando visualizado pelos anciãos
  elderMode?: boolean;
}

export default function SemanaVisitaPrint({
  data,
  onChange,
  isReadOnly = false,
  elderMode = false,
}: SemanaVisitaPrintProps) {
  const update = (updater: (prev: VisitSchedule) => VisitSchedule) => {
    if (isReadOnly || !onChange) return;
    onChange(updater(data));
  };

  // Helper para verificar se um campo é editável pelo usuário atual
  const canEdit = (fieldKey: 'midweekMeeting' | 'weekendMeeting' | 'fieldService' | 'meals' | 'shepherding' | 'studies' | 'additionalMeetings' | 'circuitOverseerOnly') => {
    if (isReadOnly) return false;
    if (!elderMode) return true; // Viajante pode editar tudo
    // Ancião respeita as permissões definidas pelo viajante
    switch (fieldKey) {
      case 'midweekMeeting':
        return data.permissions?.allowMidweekMeetingTimeEdit ?? true;
      case 'weekendMeeting':
        return data.permissions.allowWeekendMeetingTimeEdit;
      case 'fieldService':
        return data.permissions.allowFieldServiceEdit;
      case 'meals':
        return data.permissions.allowMealsEdit;
      case 'shepherding':
        return data.permissions.allowShepherdingEdit;
      case 'studies':
        return data.permissions.allowStudiesEdit;
      case 'additionalMeetings':
        return data.permissions.allowAdditionalMeetingsEdit;
      case 'circuitOverseerOnly':
        return false;
      default:
        return false;
    }
  };


  return (
    <div className="semana-visita-wrapper">
      {/* BARRA DE IMPRESSÃO */}
      <div className="print-bar">
        <button className="btn-print" onClick={() => window.print()}>
          <svg viewBox="0 0 24 24">
            <path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z" />
          </svg>
          Imprimir / Salvar PDF
        </button>
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
                  value={data.coupleNames || ''}
                  disabled={!canEdit('circuitOverseerOnly')}
                  onChange={(e) => update((prev) => ({ ...prev, coupleNames: e.target.value }))}
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
                  checked={!!data.activeDays[dayKey]}
                  disabled={!canEdit('circuitOverseerOnly')}
                  onChange={(e) =>
                    update((prev) => ({
                      ...prev,
                      activeDays: { ...prev.activeDays, [dayKey]: e.target.checked },
                    }))
                  }
                />
              </div>
            ))}
          </div>
        </div>

        {/* SERVIÇO DE CAMPO + ESTUDOS */}
        <div className="two-columns" style={{ flex: 2.2, minHeight: 0 }}>
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
                        disabled={!canEdit('fieldService')}
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

          {/* ESTUDOS E REVISITAS */}
          <div className="section stretch">
            <div className="section-header">
              <div className="section-icon">
                <svg viewBox="0 0 24 24">
                  <path d="M21 5c-1.11-.35-2.33-.5-3.5-.5-1.95 0-4.05.4-5.5 1.5-1.45-1.1-3.55-1.5-5.5-1.5S2.45 4.9 1 6v14.65c0 .25.25.5.5.5.1 0 .15-.05.25-.05C3.1 20.45 5.05 20 6.5 20c1.95 0 4.05.4 5.5 1.5 1.35-.85 3.8-1.5 5.5-1.5 1.65 0 3.35.3 4.75 1.05.1.05.15.05.25.05.25 0 .5-.25.5-.5V6c-.6-.45-1.25-.75-2-1zm0 13.5c-1.1-.35-2.3-.5-3.5-.5-1.7 0-4.15.65-5.5 1.5V8c1.35-.85 3.8-1.5 5.5-1.5 1.2 0 2.4.15 3.5.5v11.5z" />
                </svg>
              </div>
              <h2>ESTUDOS E REVISITAS</h2>
            </div>

            {/* MARIDO */}
            <div className="name-badge">
              <input
                type="text"
                value={data.studiesAndVisits.husbandName}
                disabled={!canEdit('circuitOverseerOnly')}
                onChange={(e) =>
                  update((prev) => ({
                    ...prev,
                    studiesAndVisits: { ...prev.studiesAndVisits, husbandName: e.target.value },
                  }))
                }
              />
            </div>
            <table style={{ marginBottom: 10 }}>
              <thead>
                <tr>
                  <th style={{ width: '18%' }}>DIA</th>
                  <th style={{ width: '18%' }}>HORÁRIO</th>
                  <th style={{ width: '42%' }}>ACOMPANHANTE / TEL</th>
                  <th style={{ width: '22%' }}>LIÇÃO</th>
                </tr>
              </thead>
              <tbody>
                {data.studiesAndVisits.husbandRows.map((row, idx) => (
                  <tr key={row.id || idx}>
                    <td>
                      <input
                        type="text"
                        className="editable-field"
                        value={row.day}
                        disabled={!canEdit('circuitOverseerOnly')}
                        onChange={(e) =>
                          update((prev) => {
                            const newRows = [...prev.studiesAndVisits.husbandRows];
                            newRows[idx] = { ...newRows[idx], day: e.target.value };
                            return {
                              ...prev,
                              studiesAndVisits: { ...prev.studiesAndVisits, husbandRows: newRows },
                            };
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
                            const newRows = [...prev.studiesAndVisits.husbandRows];
                            newRows[idx] = { ...newRows[idx], time: e.target.value };
                            return {
                              ...prev,
                              studiesAndVisits: { ...prev.studiesAndVisits, husbandRows: newRows },
                            };
                          })
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
                          update((prev) => {
                            const newRows = [...prev.studiesAndVisits.husbandRows];
                            newRows[idx] = { ...newRows[idx], companionPhone: e.target.value };
                            return {
                              ...prev,
                              studiesAndVisits: { ...prev.studiesAndVisits, husbandRows: newRows },
                            };
                          })
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
                          update((prev) => {
                            const newRows = [...prev.studiesAndVisits.husbandRows];
                            newRows[idx] = { ...newRows[idx], lesson: e.target.value };
                            return {
                              ...prev,
                              studiesAndVisits: { ...prev.studiesAndVisits, husbandRows: newRows },
                            };
                          })
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* ESPOSA */}
            <div className="name-badge">
              <input
                type="text"
                value={data.studiesAndVisits.wifeName}
                disabled={!canEdit('circuitOverseerOnly')}
                onChange={(e) =>
                  update((prev) => ({
                    ...prev,
                    studiesAndVisits: { ...prev.studiesAndVisits, wifeName: e.target.value },
                  }))
                }
              />
            </div>
            <table>
              <thead>
                <tr>
                  <th style={{ width: '18%' }}>DIA</th>
                  <th style={{ width: '18%' }}>HORÁRIO</th>
                  <th style={{ width: '42%' }}>ACOMPANHANTE / TEL</th>
                  <th style={{ width: '22%' }}>LIÇÃO</th>
                </tr>
              </thead>
              <tbody>
                {data.studiesAndVisits.wifeRows.map((row, idx) => (
                  <tr key={row.id || idx}>
                    <td>
                      <input
                        type="text"
                        className="editable-field"
                        value={row.day}
                        disabled={!canEdit('circuitOverseerOnly')}
                        onChange={(e) =>
                          update((prev) => {
                            const newRows = [...prev.studiesAndVisits.wifeRows];
                            newRows[idx] = { ...newRows[idx], day: e.target.value };
                            return {
                              ...prev,
                              studiesAndVisits: { ...prev.studiesAndVisits, wifeRows: newRows },
                            };
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
                            const newRows = [...prev.studiesAndVisits.wifeRows];
                            newRows[idx] = { ...newRows[idx], time: e.target.value };
                            return {
                              ...prev,
                              studiesAndVisits: { ...prev.studiesAndVisits, wifeRows: newRows },
                            };
                          })
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
                          update((prev) => {
                            const newRows = [...prev.studiesAndVisits.wifeRows];
                            newRows[idx] = { ...newRows[idx], companionPhone: e.target.value };
                            return {
                              ...prev,
                              studiesAndVisits: { ...prev.studiesAndVisits, wifeRows: newRows },
                            };
                          })
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
                          update((prev) => {
                            const newRows = [...prev.studiesAndVisits.wifeRows];
                            newRows[idx] = { ...newRows[idx], lesson: e.target.value };
                            return {
                              ...prev,
                              studiesAndVisits: { ...prev.studiesAndVisits, wifeRows: newRows },
                            };
                          })
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
                      id="sab"
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
                    <label htmlFor="sab">SÁBADO</label>
                  </div>
                  <div className="day-check-item">
                    <input
                      type="checkbox"
                      id="dom"
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
                    <label htmlFor="dom">DOMINGO</label>
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
        <div className="row-fixed" style={{ flex: 1.4, minHeight: 0 }}>
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
                              ...prev.additionalMeetings.eldersAndServants,
                              day: e.target.value,
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
                              ...prev.additionalMeetings.eldersAndServants,
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
                    borderBottom: '1px dashed #c0392b',
                    color: '#c0392b',
                    fontSize: '12px',
                    fontWeight: 800,
                    width: '60px',
                    outline: 'none',
                  }}
                  disabled={!canEdit('meals')}
                  onChange={(e) => update((prev) => ({ ...prev, mealsHeaderTime: e.target.value }))}
                />
              </h2>
            </div>
            <table style={{ height: 'calc(100% - 40px)' }}>
              <thead>
                <tr>
                  <th style={{ width: '16%' }}>DIA</th>
                  <th style={{ width: '35%' }}>ANFITRIÃO</th>
                  <th style={{ width: '49%' }}>ENDEREÇO / TELEFONE</th>
                </tr>
              </thead>
              <tbody>
                {data.meals.map((row, idx) => (
                  <tr key={row.id || idx} style={{ height: '16.6%' }}>
                    <td>{row.day}</td>
                    <td>
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
                    </td>
                    <td>
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* VISITAS DE PASTOREIO */}
        <div className="section pastoreio stretch" style={{ flex: 0.9, minHeight: 0, overflow: 'hidden' }}>
          <div className="section-header">
            <div className="section-icon">
              <svg viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
              </svg>
            </div>
            <h2>VISITAS DE PASTOREIO</h2>
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
              {data.shepherding.map((row, idx) => (
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
                        update((prev) => {
                          const newRows = [...prev.shepherding];
                          newRows[idx] = { ...newRows[idx], dateTime: e.target.value };
                          return { ...prev, shepherding: newRows };
                        })
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
                        update((prev) => {
                          const newRows = [...prev.shepherding];
                          newRows[idx] = { ...newRows[idx], family: e.target.value };
                          return { ...prev, shepherding: newRows };
                        })
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
                        update((prev) => {
                          const newRows = [...prev.shepherding];
                          newRows[idx] = { ...newRows[idx], companion: e.target.value };
                          return { ...prev, shepherding: newRows };
                        })
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
                        update((prev) => {
                          const newRows = [...prev.shepherding];
                          newRows[idx] = { ...newRows[idx], situation: e.target.value };
                          return { ...prev, shepherding: newRows };
                        })
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ESTILOS CSS EXATOS DO SEU HTML */}
      <style jsx>{`
        .semana-visita-wrapper {
          font-family: 'Roboto', Arial, sans-serif;
          background: #e8e8e8;
          color: #333;
          padding: 16px 0;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .print-bar {
          width: 210mm;
          margin: 0 auto 12px auto;
          display: flex;
          justify-content: flex-end;
          gap: 10px;
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

        .page {
          width: 210mm;
          height: 297mm;
          margin: 0 auto;
          background: #f5f3f0;
          padding: 7mm;
          box-shadow: 0 0 10px rgba(0, 0, 0, 0.2);
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
          width: 170px;
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
          flex: 1;
          min-height: 0;
        }

        .row-fixed {
          display: flex;
          gap: 5px;
          flex-shrink: 0;
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
          margin-bottom: 8px;
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
          font-size: 9px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.7px;
          padding: 4px 6px;
          text-align: left;
          border-bottom: 1px solid #ddd;
          white-space: nowrap;
          overflow: hidden;
        }

        table tbody td {
          padding: 0 6px;
          border-bottom: 1px solid #eee;
          font-size: 10.5px;
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
          font-size: 10.5px;
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
          font-size: 9.5px;
          font-weight: 700;
          padding: 3px 11px;
          border-radius: 4px;
          margin-bottom: 5px;
          letter-spacing: 0.5px;
          vertical-align: top;
        }

        .name-badge input {
          background: transparent;
          border: none;
          color: white;
          font-size: 9.5px;
          font-weight: 700;
          font-family: inherit;
          width: 65px;
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
          color: #1a5c5a;
          min-width: 120px;
          flex-shrink: 0;
        }

        .meeting-field-group {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .meeting-field-label {
          font-size: 8.5px;
          font-weight: 700;
          color: #888;
          text-transform: uppercase;
        }

        .meeting-input {
          border: none;
          border-bottom: 1px solid #ccc;
          background: transparent;
          font-family: inherit;
          font-size: 10.5px;
          width: 135px;
          padding: 1px 3px;
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
          width: 62px;
        }

        .horario-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          background: #e8f5f4;
          border-radius: 6px;
          padding: 3px 10px;
        }

        .horario-badge .meeting-field-label {
          color: #1a5c5a;
          font-weight: 700;
        }

        .horario-badge .meeting-input {
          width: 72px;
          border-bottom-color: #1a5c5a;
        }

        .day-checkbox-group {
          display: flex;
          align-items: center;
          gap: 9px;
          background: #f9f7f5;
          border: 1px solid #e0ddd8;
          border-radius: 7px;
          padding: 4px 11px;
        }

        .day-check-item {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .day-check-item input[type='checkbox'] {
          width: 13px;
          height: 13px;
          accent-color: #1a5c5a;
        }

        .day-check-item label {
          font-size: 9.5px;
          font-weight: 700;
          color: #555;
        }

        .meeting-row-container {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 5px;
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
          .print-bar {
            display: none !important;
          }

          body {
            background: white !important;
          }

          .semana-visita-wrapper {
            background: white !important;
            padding: 0 !important;
          }

          .page {
            margin: 0 !important;
            padding: 7mm !important;
            box-shadow: none !important;
            width: 210mm !important;
            height: 297mm !important;
          }

          input {
            border-bottom-style: solid !important;
          }

          @page {
            size: A4;
            margin: 0;
          }
        }
      `}</style>
    </div>
  );
}
