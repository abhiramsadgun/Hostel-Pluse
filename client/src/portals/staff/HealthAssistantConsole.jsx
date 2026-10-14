import React, { useState, useEffect } from 'react';
import { api } from '../../shared/api';
import { useAuth } from '../../shared/AuthContext';
import {
  HeartPulse,
  AlertTriangle,
  CheckCircle,
  Clock,
  Phone,
  ShieldAlert,
  Ambulance,
  Pill,
  Send,
  User,
  Shield,
  Activity,
  FileText,
  AlertOctagon,
  ArrowRight,
  Package,
} from 'lucide-react';

export function HealthAssistantConsole() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Active view tab: 'tickets' | 'inventory'
  const [activeView, setActiveView] = useState('tickets');

  // Medicine Admin Modal
  const [activeMedTicket, setActiveMedTicket] = useState(null);
  const [medicineName, setMedicineName] = useState('');
  const [dosage, setDosage] = useState('');
  const [medNotes, setMedNotes] = useState('');
  const [allergyConflictData, setAllergyConflictData] = useState(null);
  const [overrideReason, setOverrideReason] = useState('');
  const [submittingMed, setSubmittingMed] = useState(false);

  // Vehicle Dispatch Modal
  const [activeVehicleTicket, setActiveVehicleTicket] = useState(null);
  const [selectedHospital, setSelectedHospital] = useState('');
  const [vehicleType, setVehicleType] = useState('Campus Medical Van');
  const [driverContact, setDriverContact] = useState('+91 99880-11223');
  const [submittingVehicle, setSubmittingVehicle] = useState(false);

  // Status Update Modal
  const [activeStatusTicket, setActiveStatusTicket] = useState(null);
  const [newStatus, setNewStatus] = useState('On The Way');
  const [observations, setObservations] = useState('');
  const [submittingStatus, setSubmittingStatus] = useState(false);

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const [tRes, invRes] = await Promise.all([
        api.get('/health'),
        api.get('/health/inventory').catch(() => ({ success: false })),
      ]);

      if (tRes.success) {
        setTickets(tRes.data.tickets || []);
        setHospitals(tRes.data.hospitals || []);
      }
      if (invRes.success) {
        setInventory(invRes.data.inventory || []);
        setLowStockCount(invRes.data.lowStockCount || 0);
      }
    } catch (err) {
      setError(err.message || 'Failed to load clinic records.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  // Quick Action: Mark On The Way
  async function handleQuickOnTheWay(ticket) {
    try {
      const res = await api.put(`/health/${ticket.id}/status`, {
        status: 'On The Way',
        observations: 'First responder dispatched to resident room.',
      });
      if (res.success) {
        setSuccessMsg(`Status updated. Resident in Room ${ticket.room_number || 'N/A'} notified.`);
        fetchData();
      }
    } catch (e) {
      alert(e.message || 'Action failed.');
    }
  }

  // Submit Medicine Administration with Allergy Check
  async function handleSubmitMedicine(e, confirmOverride = false) {
    if (e) e.preventDefault();
    if (!activeMedTicket || !medicineName || !dosage) return;

    setSubmittingMed(true);
    setError(null);

    try {
      const payload = {
        medicineName,
        dosage,
        notes: medNotes,
        overrideAllergyWarning: confirmOverride,
        overrideReason: confirmOverride ? overrideReason : undefined,
      };

      const res = await api.post(`/health/${activeMedTicket.id}/medicine`, payload);

      if (res.success) {
        setSuccessMsg(res.data.message);
        setActiveMedTicket(null);
        setAllergyConflictData(null);
        setMedicineName('');
        setDosage('');
        setMedNotes('');
        setOverrideReason('');
        fetchData();
      }
    } catch (err) {
      // Check if allergy conflict was returned
      if (err.data?.warning) {
        setAllergyConflictData(err.data);
      } else {
        alert(err.message || 'Failed to record medicine.');
      }
    } finally {
      setSubmittingMed(false);
    }
  }

  // Request Vehicle Dispatch
  async function handleDispatchVehicle(e) {
    e.preventDefault();
    if (!activeVehicleTicket || !selectedHospital) return;

    setSubmittingVehicle(true);
    try {
      const res = await api.post(`/health/${activeVehicleTicket.id}/vehicle`, {
        hospitalName: selectedHospital,
        vehicleType,
        driverContact,
      });

      if (res.success) {
        setSuccessMsg(`Emergency transit requested to ${selectedHospital}. Resident parent notified.`);
        setActiveVehicleTicket(null);
        fetchData();
      }
    } catch (e) {
      alert(e.message || 'Vehicle request failed.');
    } finally {
      setSubmittingVehicle(false);
    }
  }

  // Update Status & Observations
  async function handleUpdateStatus(e) {
    e.preventDefault();
    if (!activeStatusTicket) return;
    setSubmittingStatus(true);

    try {
      const res = await api.put(`/health/${activeStatusTicket.id}/status`, {
        status: newStatus,
        observations: observations || undefined,
      });
      if (res.success) {
        setSuccessMsg(`Ticket updated to ${newStatus}.`);
        setActiveStatusTicket(null);
        fetchData();
      }
    } catch (e) {
      alert(e.message || 'Status update failed.');
    } finally {
      setSubmittingStatus(false);
    }
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '1.5rem auto', padding: '0 1rem' }}>
      {/* Top Banner */}
      <div className="photo-hero-banner" style={{ minHeight: '190px', marginBottom: '1.75rem' }}>
        <img
          src="https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&w=1200&q=80"
          alt="Hostel Health Attendant Station"
          className="photo-hero-image"
        />
        <div className="photo-hero-overlay">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
                <span className="flat-wheat-badge" style={{ fontSize: '0.7rem' }}>
                  Clinical Triage Console
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--golden-wheat)', fontWeight: '700' }}>
                  HEALTH ASSISTANCE &amp; MEDICINE DISPENSARY
                </span>
              </div>
              <h1 style={{ fontSize: '1.8rem', fontWeight: '800', fontFamily: 'var(--font-display)', marginBottom: '0.25rem' }}>
                Health Assistant &amp; Medic Desk
              </h1>
              <p style={{ color: 'var(--soft-wheat)', fontSize: '0.88rem' }}>
                Respond to resident medical calls, safely administer allergy-checked medications, and coordinate ambulance runs.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div
                style={{
                  background: 'var(--deep-gray)',
                  border: '1px solid var(--border-medium)',
                  borderTop: '3px solid #ef4444',
                  padding: '0.65rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Active SOS/Emergencies</div>
                <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#f87171' }}>
                  {tickets.filter(t => (t.is_sos || t.severity === 'emergency') && t.status !== 'Resolved').length}
                </div>
              </div>

              {lowStockCount > 0 && (
                <div
                  style={{
                    background: 'var(--deep-gray)',
                    border: '1px solid var(--border-medium)',
                    borderTop: '3px solid #fbbf24',
                    padding: '0.65rem 1rem',
                    borderRadius: 'var(--radius-md)',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Low Medicine Stock</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#fbbf24' }}>{lowStockCount}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      {successMsg && (
        <div className="alert alert-success" style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CheckCircle size={18} /> {successMsg}
          </div>
          <button onClick={() => setSuccessMsg(null)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}>
            ✕
          </button>
        </div>
      )}

      {/* View Switcher */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-medium)', paddingBottom: '0.5rem' }}>
        <button
          className={`btn btn-sm ${activeView === 'tickets' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveView('tickets')}
        >
          <Activity size={16} /> Patient Calls &amp; Triage ({tickets.length})
        </button>
        <button
          className={`btn btn-sm ${activeView === 'inventory' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveView('inventory')}
        >
          <Package size={16} /> Medicine Inventory &amp; Stock Alerts ({inventory.length})
        </button>
      </div>

      {/* VIEW: TICKETS */}
      {activeView === 'tickets' && (
        <div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--soft-wheat)' }}>
              <div>Loading triage queue...</div>
            </div>
          ) : tickets.length === 0 ? (
            <div className="flat-card" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
              <CheckCircle size={36} color="var(--golden-wheat)" style={{ marginBottom: '0.75rem', opacity: 0.6 }} />
              <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '0.35rem' }}>No Active Medical Tickets</h3>
              <p style={{ color: 'var(--soft-wheat)', fontSize: '0.85rem' }}>All residents in good health.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {tickets.map(t => {
                const isEmergency = t.is_sos || t.severity === 'emergency';
                const hasAllergies = t.student_allergies && t.student_allergies !== 'none' && t.student_allergies !== 'nil';

                return (
                  <div
                    key={t.id}
                    className="flat-card"
                    style={{
                      padding: '1.25rem 1.5rem',
                      borderLeft: isEmergency ? '4px solid #ef4444' : '4px solid var(--golden-wheat)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                      <div style={{ flex: '1 1 380px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.45rem', flexWrap: 'wrap' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '800', color: 'var(--golden-wheat)' }}>
                            HT-{t.id.toString().padStart(5, '0')}
                          </span>
                          {t.is_sos && (
                            <span style={{ background: '#ef4444', color: '#fff', fontSize: '0.68rem', fontWeight: '800', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                              🚨 CODE RED SOS
                            </span>
                          )}
                          <span className="flat-wheat-badge" style={{ fontSize: '0.7rem', textTransform: 'uppercase' }}>
                            {t.severity}
                          </span>
                          <span className="flat-badge" style={{ fontSize: '0.7rem' }}>
                            Status: {t.status}
                          </span>
                        </div>

                        <div style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                          {t.student_name} &bull; Room {t.room_number || 'N/A'} ({t.block_name})
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--soft-wheat)', marginBottom: '0.5rem' }}>
                          Roll: {t.student_roll} &bull; Parent: {t.parent_name} ({t.parent_phone})
                        </div>

                        {/* Symptoms */}
                        <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                          <strong>Symptoms:</strong> {t.symptoms}
                        </div>

                        {/* Known Allergies Alert Pill */}
                        <div
                          style={{
                            background: hasAllergies ? 'rgba(239, 68, 68, 0.15)' : 'var(--deep-gray)',
                            border: `1px solid ${hasAllergies ? '#ef4444' : 'var(--border-subtle)'}`,
                            padding: '0.45rem 0.75rem',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '0.78rem',
                            color: hasAllergies ? '#f87171' : 'var(--soft-wheat)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            marginBottom: '0.5rem',
                          }}
                        >
                          <Activity size={14} />
                          <span><strong>Registered Allergies:</strong> {t.student_allergies || 'None declared'}</span>
                        </div>

                        {t.observations && (
                          <div style={{ fontSize: '0.82rem', color: 'var(--soft-wheat)', background: 'rgba(0,0,0,0.25)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)' }}>
                            <strong>Clinical Notes:</strong> {t.observations}
                          </div>
                        )}
                      </div>

                      {/* Right Action Buttons */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: '220px' }}>
                        {t.status === 'Open' && (
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => handleQuickOnTheWay(t)}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
                          >
                            <ArrowRight size={14} /> Mark "On The Way"
                          </button>
                        )}

                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            setActiveMedTicket(t);
                            setMedicineName('');
                            setDosage('');
                            setMedNotes('');
                            setAllergyConflictData(null);
                          }}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
                        >
                          <Pill size={14} color="var(--golden-wheat)" /> Administer Medicine
                        </button>

                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            setActiveVehicleTicket(t);
                            setSelectedHospital(hospitals[0]?.name || 'Campus University Health Centre');
                          }}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', color: '#f87171', borderColor: '#ef4444' }}
                        >
                          <Ambulance size={14} /> Request Van / Hospital
                        </button>

                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            setActiveStatusTicket(t);
                            setNewStatus(t.status);
                            setObservations(t.observations || '');
                          }}
                        >
                          Update Status / Resolution
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VIEW: INVENTORY */}
      {activeView === 'inventory' && (
        <div className="flat-card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: '800', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Package size={20} color="var(--golden-wheat)" /> First Aid &amp; Dispensary Medicine Stock
          </h3>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-medium)', color: 'var(--golden-wheat)' }}>
                  <th style={{ padding: '0.75rem' }}>Medicine Name</th>
                  <th style={{ padding: '0.75rem' }}>Generic Composition</th>
                  <th style={{ padding: '0.75rem' }}>Category</th>
                  <th style={{ padding: '0.75rem' }}>Current Stock</th>
                  <th style={{ padding: '0.75rem' }}>Min Alert Threshold</th>
                  <th style={{ padding: '0.75rem' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {inventory.map(item => (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '0.75rem', fontWeight: '700' }}>{item.name}</td>
                    <td style={{ padding: '0.75rem', color: 'var(--soft-wheat)' }}>{item.generic_name || '-'}</td>
                    <td style={{ padding: '0.75rem' }}>{item.category}</td>
                    <td style={{ padding: '0.75rem', fontWeight: '800', color: item.is_low_stock ? '#f87171' : 'var(--text-primary)' }}>
                      {item.stock_quantity} {item.unit}
                    </td>
                    <td style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>{item.min_threshold} {item.unit}</td>
                    <td style={{ padding: '0.75rem' }}>
                      {item.is_low_stock ? (
                        <span style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', border: '1px solid #ef4444', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.72rem', fontWeight: '800' }}>
                          LOW STOCK
                        </span>
                      ) : (
                        <span style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', border: '1px solid #10b981', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.72rem', fontWeight: '700' }}>
                          ADEQUATE
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Administer Medicine Modal */}
      {activeMedTicket && (
        <div className="modal-backdrop">
          <div className="modal-content flat-card" style={{ maxWidth: '520px', width: '92%', border: '1px solid var(--golden-wheat)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <span className="flat-wheat-badge" style={{ fontSize: '0.7rem' }}>Clinical Log</span>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '800', fontFamily: 'var(--font-display)', marginTop: '0.2rem' }}>
                  Administer Medicine
                </h2>
              </div>
              <button
                onClick={() => setActiveMedTicket(null)}
                style={{ background: 'none', border: 'none', color: 'var(--soft-wheat)', cursor: 'pointer', fontSize: '1.25rem' }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--soft-wheat)', marginBottom: '1rem' }}>
              Patient: <strong>{activeMedTicket.student_name}</strong> (Room {activeMedTicket.room_number})
            </p>

            {/* Patient Allergy Summary */}
            <div
              style={{
                background: 'var(--deep-gray)',
                padding: '0.65rem 0.85rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-medium)',
                fontSize: '0.8rem',
                marginBottom: '1rem',
              }}
            >
              <div style={{ color: 'var(--text-muted)' }}>PATIENT REGISTERED ALLERGIES:</div>
              <div style={{ fontWeight: '700', color: activeMedTicket.student_allergies ? '#f87171' : 'var(--text-primary)' }}>
                {activeMedTicket.student_allergies || 'None recorded'}
              </div>
            </div>

            {/* HIGH-CONTRAST ALLERGY CONFLICT WARNING */}
            {allergyConflictData && (
              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.25)',
                  border: '2px solid #ef4444',
                  padding: '1rem',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: '1.25rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f87171', fontWeight: '800', fontSize: '0.95rem', marginBottom: '0.35rem' }}>
                  <AlertOctagon size={18} /> SEVERE ALLERGY CONFLICT DETECTED
                </div>
                <p style={{ fontSize: '0.82rem', color: '#fee2e2', lineHeight: '1.4', marginBottom: '0.75rem' }}>
                  Student has a documented allergy to <strong>"{allergyConflictData.knownAllergies}"</strong>. Prescribing <strong>"{allergyConflictData.medicineName}"</strong> may provoke anaphylaxis or an acute reaction.
                </p>

                <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                  <label className="form-label" style={{ fontWeight: '700', color: '#fca5a5' }}>
                    Attending Physician Override Reason *
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Approved by Dr. Sharma over phone; antihistamine co-administered."
                    value={overrideReason}
                    onChange={e => setOverrideReason(e.target.value)}
                    required
                  />
                </div>

                <button
                  type="button"
                  className="btn btn-danger"
                  disabled={!overrideReason.trim()}
                  onClick={() => handleSubmitMedicine(null, true)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
                >
                  <ShieldAlert size={16} /> Confirm Clinical Override &amp; Administer
                </button>
              </div>
            )}

            {!allergyConflictData && (
              <form onSubmit={e => handleSubmitMedicine(e, false)}>
                <div className="form-group" style={{ marginBottom: '0.85rem' }}>
                  <label className="form-label" style={{ fontWeight: '700' }}>Medicine Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Paracetamol / Cetirizine / Ibuprofen"
                    value={medicineName}
                    onChange={e => setMedicineName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '0.85rem' }}>
                  <label className="form-label" style={{ fontWeight: '700' }}>Dosage *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. 500mg, 1 tablet after food"
                    value={dosage}
                    onChange={e => setDosage(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                  <label className="form-label">Medic Notes (Optional)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Temperature 101.4°F recorded"
                    value={medNotes}
                    onChange={e => setMedNotes(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setActiveMedTicket(null)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={submittingMed}>
                    {submittingMed ? 'Verifying Allergies...' : 'Check Allergies & Administer'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Vehicle Dispatch Modal */}
      {activeVehicleTicket && (
        <div className="modal-backdrop">
          <div className="modal-content flat-card" style={{ maxWidth: '520px', width: '92%', border: '1px solid #ef4444' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <span className="flat-wheat-badge" style={{ fontSize: '0.7rem' }}>Emergency Hospital Dispatch</span>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '800', fontFamily: 'var(--font-display)', marginTop: '0.2rem' }}>
                  Dispatch Medical Van / Ambulance
                </h2>
              </div>
              <button
                onClick={() => setActiveVehicleTicket(null)}
                style={{ background: 'none', border: 'none', color: 'var(--soft-wheat)', cursor: 'pointer', fontSize: '1.25rem' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleDispatchVehicle}>
              <div className="form-group" style={{ marginBottom: '0.85rem' }}>
                <label className="form-label" style={{ fontWeight: '700' }}>Destination Hospital *</label>
                <select
                  className="form-input"
                  value={selectedHospital}
                  onChange={e => setSelectedHospital(e.target.value)}
                  required
                >
                  {hospitals.map(h => (
                    <option key={h.id} value={h.name}>
                      {h.name} ({h.distance}) - {h.contact}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: '0.85rem' }}>
                <label className="form-label" style={{ fontWeight: '700' }}>Vehicle Type *</label>
                <select
                  className="form-input"
                  value={vehicleType}
                  onChange={e => setVehicleType(e.target.value)}
                  required
                >
                  <option value="Campus Medical Van">Campus Medical Van (Standard)</option>
                  <option value="Ambulance">Emergency Ambulance (ICU Equipped)</option>
                  <option value="Hostel Emergency Cab">Hostel Emergency Cab</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="form-label">Driver / Pilot Contact</label>
                <input
                  type="text"
                  className="form-input"
                  value={driverContact}
                  onChange={e => setDriverContact(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setActiveVehicleTicket(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-danger" disabled={submittingVehicle}>
                  {submittingVehicle ? 'Dispatching...' : 'Dispatch Vehicle & Notify Parents'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Update Status Modal */}
      {activeStatusTicket && (
        <div className="modal-backdrop">
          <div className="modal-content flat-card" style={{ maxWidth: '480px', width: '92%', border: '1px solid var(--golden-wheat)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <span className="flat-wheat-badge" style={{ fontSize: '0.7rem' }}>Clinical Status</span>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '800', fontFamily: 'var(--font-display)', marginTop: '0.2rem' }}>
                  Update Consultation Status
                </h2>
              </div>
              <button
                onClick={() => setActiveStatusTicket(null)}
                style={{ background: 'none', border: 'none', color: 'var(--soft-wheat)', cursor: 'pointer', fontSize: '1.25rem' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateStatus}>
              <div className="form-group" style={{ marginBottom: '0.85rem' }}>
                <label className="form-label" style={{ fontWeight: '700' }}>Status *</label>
                <select
                  className="form-input"
                  value={newStatus}
                  onChange={e => setNewStatus(e.target.value)}
                  required
                >
                  <option value="Open">Open</option>
                  <option value="On The Way">On The Way</option>
                  <option value="Under Care">Under Care (Attendant at room)</option>
                  <option value="Hospital Referred">Hospital Referred</option>
                  <option value="Resolved">Resolved (Patient stable)</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="form-label">Clinical Observations &amp; Advice</label>
                <textarea
                  className="form-input"
                  rows="3"
                  placeholder="Record vitals, diagnosis, and home recovery instructions..."
                  value={observations}
                  onChange={e => setObservations(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setActiveStatusTicket(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submittingStatus}>
                  {submittingStatus ? 'Updating...' : 'Save Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
