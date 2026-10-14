import React, { useState, useEffect } from 'react';
import { api } from '../../shared/api';
import {
  Utensils,
  Clock,
  CheckCircle,
  AlertCircle,
  Lock,
  Calendar,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';

export function StudentFoodPortal({ user, onProfileUpdated }) {
  const [activeTab, setActiveTab] = useState('tomorrow'); // 'tomorrow' | 'today' | 'weekly'
  const [dailyData, setDailyData] = useState(null);
  const [preferencesData, setPreferencesData] = useState(null);
  const [weeklyTemplates, setWeeklyTemplates] = useState([]);
  const [selectedDayWeek, setSelectedDayWeek] = useState(1);
  const [loading, setLoading] = useState(true);
  const [savingMealType, setSavingMealType] = useState(null);
  const [toastMsg, setToastMsg] = useState(null);
  const [toastError, setToastError] = useState(null);

  // Live countdown state (in seconds)
  const [secondsLeft, setSecondsLeft] = useState(0);

  // Default diet preference toggle state
  const [updatingDiet, setUpdatingDiet] = useState(false);

  // 1. Fetch Daily Derived Menu & Student Preferences
  async function loadData() {
    setLoading(true);
    setToastError(null);
    try {
      const [dailyRes, prefRes, templateRes] = await Promise.all([
        api.get('/food/daily'),
        api.get('/food/preferences'),
        api.get('/food/template'),
      ]);

      if (dailyRes.success) {
        setDailyData(dailyRes.data);
        if (dailyRes.data.cutoff) {
          setSecondsLeft(dailyRes.data.cutoff.secondsRemaining || 0);
        }
      }

      if (prefRes.success) {
        setPreferencesData(prefRes.data);
      }

      if (templateRes.success) {
        setWeeklyTemplates(templateRes.data.templates || []);
      }
    } catch (err) {
      setToastError('Failed to load mess data: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // 2. Countdown Timer Ticking every second
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const interval = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          // Trigger reload when lock passes
          loadData();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [secondsLeft]);

  // Format seconds into HH:MM:SS
  function formatCountdown(sec) {
    if (sec <= 0) return '00h 00m 00s';
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    const pad = n => String(n).padStart(2, '0');
    return `${pad(hrs)}h ${pad(mins)}m ${pad(s)}s`;
  }

  // 3. Handle Student Daily Choice Toggle
  async function handleToggleChoice(mealType, newChoice) {
    if (preferencesData?.cutoff?.isLocked) {
      setToastError(`Cut-off has passed (locked at ${preferencesData.cutoff.displayTime} IST). Changes are closed.`);
      return;
    }

    setSavingMealType(mealType);
    setToastMsg(null);
    setToastError(null);

    try {
      const tomorrowDate = dailyData?.tomorrow?.date;
      const res = await api.post('/food/preferences', {
        date: tomorrowDate,
        mealType,
        choice: newChoice,
      });

      if (res.success) {
        setToastMsg(`Saved: ${newChoice === 'non_veg' ? '🍗 Non-Vegetarian' : '🌱 Vegetarian'} choice for ${mealType}.`);
        // Refresh preferences
        const prefRes = await api.get(`/food/preferences?date=${tomorrowDate}`);
        if (prefRes.success) {
          setPreferencesData(prefRes.data);
        }
      } else {
        setToastError(res.error?.message || 'Failed to update meal preference.');
      }
    } catch (err) {
      setToastError(err.message || 'Error recording meal choice.');
    } finally {
      setSavingMealType(null);
    }
  }

  // 4. Handle Student Updating Default Diet Preference
  async function handleUpdateDefaultDiet(newDiet) {
    setUpdatingDiet(true);
    setToastMsg(null);
    setToastError(null);
    try {
      const res = await api.put('/food/diet-preference', { dietPreference: newDiet });
      if (res.success) {
        setToastMsg(`Your default diet profile has been updated to ${newDiet === 'non_veg' ? 'Non-Vegetarian' : 'Vegetarian'}.`);
        loadData();
        if (onProfileUpdated) onProfileUpdated();
      } else {
        setToastError(res.error?.message || 'Failed to update diet preference.');
      }
    } catch (err) {
      setToastError(err.message || 'Failed to update diet preference.');
    } finally {
      setUpdatingDiet(false);
    }
  }

  const isLocked = preferencesData?.cutoff?.isLocked || secondsLeft === 0;
  const currentDiet = preferencesData?.studentDietPreference || user?.dietPreference || 'veg';

  const DAY_NAMES = [
    { num: 1, name: 'Monday' },
    { num: 2, name: 'Tuesday' },
    { num: 3, name: 'Wednesday' },
    { num: 4, name: 'Thursday' },
    { num: 5, name: 'Friday' },
    { num: 6, name: 'Saturday' },
    { num: 7, name: 'Sunday' },
  ];

  if (loading && !dailyData) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--soft-wheat)' }}>
        <RefreshCw size={32} className="spin" style={{ margin: '0 auto 1rem', color: 'var(--golden-wheat)' }} />
        <div>Loading Mess Menu & Diet Preferences...</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1080px', margin: '0 auto', paddingBottom: '3rem' }}>
      {/* Top Banner: Cut-off Alert & Countdown */}
      <div
        className="glass-panel"
        style={{
          padding: '1.25rem 1.5rem',
          marginBottom: '1.5rem',
          border: isLocked ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(163, 146, 116, 0.4)',
          background: isLocked ? 'rgba(239, 68, 68, 0.08)' : 'rgba(163, 146, 116, 0.12)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                background: isLocked ? 'rgba(239, 68, 68, 0.2)' : 'rgba(163, 146, 116, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                color: isLocked ? 'var(--accent-rose)' : 'var(--golden-wheat)',
              }}
            >
              {isLocked ? <Lock size={22} /> : <Clock size={22} />}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontWeight: '800', fontSize: '1.05rem', color: isLocked ? 'var(--accent-rose)' : 'var(--text-primary)' }}>
                  {isLocked
                    ? `Tomorrow's Choices are Locked (${preferencesData?.cutoff?.displayTime || '09:00 PM IST'})`
                    : `Tomorrow's Meal Selection Closes at ${preferencesData?.cutoff?.displayTime || '09:00 PM IST'}`}
                </span>
                <span className={`badge ${isLocked ? 'badge-role' : 'badge-pending'}`} style={{ fontSize: '0.7rem' }}>
                  {isLocked ? 'LOCKED' : 'SELECTION ACTIVE'}
                </span>
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--soft-wheat)', margin: '0.2rem 0 0' }}>
                {isLocked
                  ? 'The kitchen prep roster has closed. Unconfirmed meals will use your registered profile default.'
                  : 'Confirm or switch between Veg and Non-Veg for tomorrow before the deadline tonight.'}
              </p>
            </div>
          </div>

          {/* Countdown Pill */}
          {!isLocked && (
            <div
              style={{
                background: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-md)',
                padding: '0.5rem 1rem',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '0.7rem', color: 'var(--golden-wheat)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Time Remaining
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                {formatCountdown(secondsLeft)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Profile Default Diet Card */}
      <div
        className="glass-panel"
        style={{
          padding: '1.1rem 1.5rem',
          marginBottom: '1.75rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '1.5rem' }}>{currentDiet === 'non_veg' ? '🍗' : '🌱'}</span>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Registered Base Diet Preference</div>
            <div style={{ fontSize: '1.05rem', fontWeight: '700', color: 'var(--text-primary)' }}>
              {currentDiet === 'non_veg' ? 'Non-Vegetarian (Default)' : 'Vegetarian (Default)'}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--soft-wheat)' }}>
              Applied automatically whenever you do not submit an explicit daily choice before 9 PM.
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className={`btn btn-sm ${currentDiet === 'veg' ? 'btn-primary' : 'btn-secondary'}`}
            disabled={updatingDiet || currentDiet === 'veg'}
            onClick={() => handleUpdateDefaultDiet('veg')}
          >
            🌱 Set Default Veg
          </button>
          <button
            className={`btn btn-sm ${currentDiet === 'non_veg' ? 'btn-primary' : 'btn-secondary'}`}
            disabled={updatingDiet || currentDiet === 'non_veg'}
            onClick={() => handleUpdateDefaultDiet('non_veg')}
          >
            🍗 Set Default Non-Veg
          </button>
        </div>
      </div>

      {toastMsg && <div className="alert alert-success">{toastMsg}</div>}
      {toastError && <div className="alert alert-error">{toastError}</div>}

      {/* Navigation Subtabs */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          marginBottom: '1.5rem',
          borderBottom: '1px solid var(--border-medium)',
          paddingBottom: '0.75rem',
          flexWrap: 'wrap',
        }}
      >
        <button
          className={`btn ${activeTab === 'tomorrow' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('tomorrow')}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <Utensils size={16} /> Tomorrow's Meals & Choice ({dailyData?.tomorrow?.dayName || 'Tomorrow'})
        </button>
        <button
          className={`btn ${activeTab === 'today' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('today')}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <Calendar size={16} /> Today's Live Menu ({dailyData?.today?.dayName || 'Today'})
        </button>
        <button
          className={`btn ${activeTab === 'weekly' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('weekly')}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <Clock size={16} /> Full Weekly Rotation (Mon-Sun)
        </button>
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: TOMORROW'S MEALS & STUDENT CHOICE SELECTOR                     */}
      {/* ===================================================================== */}
      {activeTab === 'tomorrow' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h2 style={{ fontSize: '1.35rem', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
                Tomorrow's Dining Menu: {dailyData?.tomorrow?.dayName} ({dailyData?.tomorrow?.date})
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--soft-wheat)', margin: '0.2rem 0 0' }}>
                Select your preference for each meal below. Non-veg option is only available on selected days.
              </p>
            </div>

            <button
              className="btn btn-secondary btn-sm"
              onClick={loadData}
              title="Refresh Preferences"
            >
              <RefreshCw size={14} /> Refresh Choices
            </button>
          </div>

          {/* Meal Preference Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {preferencesData?.meals?.map(m => {
              const isSaving = savingMealType === m.mealType;
              const isVegSelected = m.choice === 'veg';
              const isNonvegSelected = m.choice === 'non_veg';

              return (
                <div
                  key={m.mealType}
                  className="glass-panel"
                  style={{
                    padding: '1.5rem',
                    border: isNonvegSelected
                      ? '1px solid rgba(163, 146, 116, 0.5)'
                      : '1px solid rgba(16, 185, 129, 0.4)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem' }}>
                        <span className="badge badge-role" style={{ textTransform: 'uppercase', fontSize: '0.8rem' }}>
                          {m.mealType}
                        </span>
                        <span style={{ fontSize: '0.9rem', color: 'var(--golden-wheat)', fontWeight: '700' }}>
                          <Clock size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
                          {m.mealTime}
                        </span>
                        {m.nonvegAvailable ? (
                          <span className="badge badge-pending" style={{ fontSize: '0.7rem' }}>
                            🍗 Non-Veg Served
                          </span>
                        ) : (
                          <span className="badge badge-approved" style={{ fontSize: '0.7rem' }}>
                            🌱 Pure Vegetarian
                          </span>
                        )}
                      </div>

                      {/* Explicit confirmation pill */}
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                        Status:{' '}
                        {m.isExplicit ? (
                          <span style={{ color: 'var(--accent-emerald)', fontWeight: '700' }}>
                            ✓ Confirmed by you ({m.updatedAt ? new Date(m.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Saved'})
                          </span>
                        ) : (
                          <span style={{ color: 'var(--golden-wheat)' }}>
                            Using profile default diet preference
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Current Choice Indicator */}
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Tomorrow's Serving</div>
                      <div
                        style={{
                          fontSize: '1.05rem',
                          fontWeight: '800',
                          color: isNonvegSelected ? 'var(--golden-wheat)' : 'var(--accent-emerald)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          justifyContent: 'flex-end',
                          marginTop: '0.15rem',
                        }}
                      >
                        {isNonvegSelected ? '🍗 Non-Vegetarian' : '🌱 Vegetarian'}
                      </div>
                    </div>
                  </div>

                  {/* Menu Description */}
                  <div style={{ display: 'grid', gridTemplateColumns: m.nonvegAvailable ? '1fr 1fr' : '1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                    {/* Veg Items */}
                    <div
                      style={{
                        padding: '1rem',
                        borderRadius: 'var(--radius-md)',
                        background: 'rgba(16, 185, 129, 0.05)',
                        border: '1px solid rgba(16, 185, 129, 0.2)',
                      }}
                    >
                      <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--accent-emerald)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                        🌱 Vegetarian Dishes:
                      </div>
                      <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', margin: 0, lineHeight: 1.4 }}>
                        {m.vegItems}
                      </p>
                    </div>

                    {/* Non-veg items if available */}
                    {m.nonvegAvailable && (
                      <div
                        style={{
                          padding: '1rem',
                          borderRadius: 'var(--radius-md)',
                          background: 'rgba(163, 146, 116, 0.08)',
                          border: '1px solid rgba(163, 146, 116, 0.25)',
                        }}
                      >
                        <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--golden-wheat)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                          🍗 Non-Vegetarian Special:
                        </div>
                        <p style={{ fontSize: '0.9rem', color: 'var(--soft-wheat)', margin: 0, lineHeight: 1.4 }}>
                          {m.nonvegItems || 'Chef Special Non-Veg Preparation'}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Veg / Non-Veg Toggle Selector Buttons */}
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      disabled={isLocked || isSaving}
                      onClick={() => handleToggleChoice(m.mealType, 'veg')}
                      style={{
                        flex: 1,
                        minWidth: '180px',
                        padding: '0.75rem 1rem',
                        borderRadius: 'var(--radius-md)',
                        border: isVegSelected ? '2px solid var(--accent-emerald)' : '1px solid var(--border-subtle)',
                        background: isVegSelected ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.02)',
                        color: isVegSelected ? 'var(--accent-emerald)' : 'var(--text-secondary)',
                        fontWeight: isVegSelected ? '700' : '500',
                        fontSize: '0.9rem',
                        cursor: isLocked ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      {isVegSelected && <CheckCircle size={16} color="var(--accent-emerald)" />}
                      🌱 Select Vegetarian
                    </button>

                    {m.nonvegAvailable ? (
                      <button
                        type="button"
                        disabled={isLocked || isSaving}
                        onClick={() => handleToggleChoice(m.mealType, 'non_veg')}
                        style={{
                          flex: 1,
                          minWidth: '180px',
                          padding: '0.75rem 1rem',
                          borderRadius: 'var(--radius-md)',
                          border: isNonvegSelected ? '2px solid var(--golden-wheat)' : '1px solid var(--border-subtle)',
                          background: isNonvegSelected ? 'rgba(163, 146, 116, 0.2)' : 'rgba(255, 255, 255, 0.02)',
                          color: isNonvegSelected ? 'var(--golden-wheat)' : 'var(--text-secondary)',
                          fontWeight: isNonvegSelected ? '700' : '500',
                          fontSize: '0.9rem',
                          cursor: isLocked ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.5rem',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        {isNonvegSelected && <CheckCircle size={16} color="var(--golden-wheat)" />}
                        🍗 Select Non-Vegetarian
                      </button>
                    ) : (
                      <div
                        style={{
                          flex: 1,
                          minWidth: '180px',
                          padding: '0.75rem 1rem',
                          borderRadius: 'var(--radius-md)',
                          border: '1px dashed var(--border-subtle)',
                          background: 'rgba(0, 0, 0, 0.2)',
                          color: 'var(--text-muted)',
                          fontSize: '0.85rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.4rem',
                        }}
                      >
                        🚫 Non-Veg not served on this meal
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Next Day Choices Summary Card */}
          <div className="glass-panel" style={{ marginTop: '1.75rem', padding: '1.5rem', background: 'rgba(255, 255, 255, 0.02)' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--golden-wheat)', marginBottom: '0.75rem' }}>
              Summary of Your Confirmed Servings for Tomorrow
            </h3>

            <div className="grid-4">
              {preferencesData?.meals?.map(m => (
                <div key={m.mealType} style={{ padding: '0.75rem', background: 'rgba(0, 0, 0, 0.3)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    {m.mealType}
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: '700', marginTop: '0.25rem', color: m.choice === 'non_veg' ? 'var(--golden-wheat)' : 'var(--accent-emerald)' }}>
                    {m.choice === 'non_veg' ? '🍗 Non-Veg' : '🌱 Veg'}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--soft-wheat)', marginTop: '0.2rem' }}>
                    {m.mealTime}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: TODAY'S LIVE MENU CARD                                         */}
      {/* ===================================================================== */}
      {activeTab === 'today' && (
        <div>
          <div style={{ marginBottom: '1.25rem' }}>
            <h2 style={{ fontSize: '1.35rem', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
              Today's Live Campus Menu: {dailyData?.today?.dayName} ({dailyData?.today?.date})
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--soft-wheat)', margin: '0.2rem 0 0' }}>
              Derived automatically from the South Indian hostel weekly rotation.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {dailyData?.today?.meals?.map(m => (
              <div key={m.meal_type} className="glass-panel" style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <span className="badge badge-role" style={{ textTransform: 'uppercase', fontSize: '0.8rem' }}>
                      {m.meal_type}
                    </span>
                    <span style={{ fontSize: '0.9rem', color: 'var(--golden-wheat)', fontWeight: '700' }}>
                      <Clock size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
                      {m.meal_time}
                    </span>
                  </div>
                  {m.nonveg_available ? (
                    <span className="badge badge-pending" style={{ fontSize: '0.75rem' }}>
                      🍗 Non-Veg Served Today
                    </span>
                  ) : (
                    <span className="badge badge-approved" style={{ fontSize: '0.75rem' }}>
                      🌱 Pure Vegetarian
                    </span>
                  )}
                </div>

                <div style={{ marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--accent-emerald)', textTransform: 'uppercase' }}>
                    Vegetarian Dishes:
                  </span>
                  <p style={{ fontSize: '0.95rem', color: 'var(--text-primary)', margin: '0.2rem 0 0', lineHeight: 1.4 }}>
                    {m.veg_items}
                  </p>
                </div>

                {m.nonveg_available && (
                  <div>
                    <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--golden-wheat)', textTransform: 'uppercase' }}>
                      Non-Vegetarian Special:
                    </span>
                    <p style={{ fontSize: '0.95rem', color: 'var(--soft-wheat)', margin: '0.2rem 0 0', lineHeight: 1.4 }}>
                      {m.nonveg_items}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: 7-DAY RECURRING WEEKLY ROTATION                                */}
      {/* ===================================================================== */}
      {activeTab === 'weekly' && (
        <div>
          <div className="glass-panel" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
                  Hostel South Indian Weekly Rotation
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--soft-wheat)', margin: '0.2rem 0 0' }}>
                  Select any weekday to inspect upcoming breakfast, lunch, snacks, and dinner.
                </p>
              </div>

              {/* Day Pills */}
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {DAY_NAMES.map(d => (
                  <button
                    key={d.num}
                    className={`btn btn-sm ${selectedDayWeek === d.num ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setSelectedDayWeek(d.num)}
                    style={{ minWidth: '85px' }}
                  >
                    {d.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {weeklyTemplates
              .filter(t => t.day_of_week === selectedDayWeek)
              .map(t => (
                <div key={t.id} className="glass-panel" style={{ padding: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <span className="badge badge-role" style={{ textTransform: 'uppercase', fontSize: '0.8rem' }}>
                        {t.meal_type}
                      </span>
                      <span style={{ fontSize: '0.9rem', color: 'var(--golden-wheat)', fontWeight: '700' }}>
                        {t.meal_time}
                      </span>
                    </div>
                    {t.nonveg_available ? (
                      <span className="badge badge-pending" style={{ fontSize: '0.75rem' }}>
                        🍗 Non-Veg Available
                      </span>
                    ) : (
                      <span className="badge badge-approved" style={{ fontSize: '0.75rem' }}>
                        🌱 Pure Veg
                      </span>
                    )}
                  </div>

                  <div style={{ marginBottom: '0.4rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--accent-emerald)', textTransform: 'uppercase' }}>
                      Veg Items:
                    </span>
                    <p style={{ fontSize: '0.95rem', color: 'var(--text-primary)', margin: '0.2rem 0 0' }}>
                      {t.veg_items}
                    </p>
                  </div>

                  {t.nonveg_available && (
                    <div>
                      <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--golden-wheat)', textTransform: 'uppercase' }}>
                        Non-Veg Items:
                      </span>
                      <p style={{ fontSize: '0.95rem', color: 'var(--soft-wheat)', margin: '0.2rem 0 0' }}>
                        {t.nonveg_items}
                      </p>
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
