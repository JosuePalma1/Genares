import { createContext, useContext, useEffect, useReducer } from 'react';
import { EVALUATION_STATUS, createInitialState } from '../data/prototypeData';
import { areWrittenReviewsClosed, canEditTribunal } from '../domain/workflow';

const STORAGE_KEY = 'genares-prototype-v2';
const PrototypeContext = createContext(null);

const now = () => new Date().toISOString();
const clone = (value) => JSON.parse(JSON.stringify(value));

function notificationForPerson(state, personId, notification) {
  const actor = state.actors.find((item) => item.personId === personId);
  if (!actor) return null;
  return {
    id: `notice-${Date.now()}-${personId}-${Math.random().toString(36).slice(2, 7)}`,
    recipientId: actor.id,
    createdAt: now(),
    readAt: null,
    ...notification,
  };
}

function makeEvaluation(work, memberId, rubric) {
  return {
    id: `${work.id}-${memberId}`,
    workId: work.id,
    memberId,
    rubricVersionId: rubric.id,
    rubricSnapshot: clone(rubric),
    written: { status: EVALUATION_STATUS.PENDING, scores: {}, observations: {} },
    oralByStudent: {},
  };
}

function reducer(state, action) {
  switch (action.type) {
    case 'SET_CURRENT_ACTOR':
      return { ...state, currentActorId: action.actorId };

    case 'REGISTER_WORK': {
      return {
        ...state,
        people: [...state.people, ...action.students],
        works: [action.work, ...state.works],
      };
    }

    case 'ASSIGN_TRIBUNAL': {
      const work = state.works.find((item) => item.id === action.workId);
      if (!work || action.memberIds.length !== 2 || new Set(action.memberIds).size !== 2 || !canEditTribunal(state, work)) return state;
      const rubric = state.rubricVersions.find((item) => item.id === work.rubricVersionId);
      if (!rubric) return state;
      const updatedWork = { ...work, tribunalIds: [...action.memberIds], tribunalAssignedAt: now() };
      const unrelated = state.evaluations.filter((evaluation) => evaluation.workId !== work.id);
      const newEvaluations = action.memberIds.map((memberId) => makeEvaluation(updatedWork, memberId, rubric));
      const notifications = action.memberIds
        .map((memberId) => notificationForPerson(state, memberId, {
          type: 'TRIBUNAL_ASSIGNED', workId: work.id,
          title: 'Nueva asignación de tribunal',
          message: `Ha sido asignado como miembro del tribunal del trabajo “${work.title}”.`,
          route: '/mis-evaluaciones',
        }))
        .filter(Boolean);
      return {
        ...state,
        works: state.works.map((item) => item.id === work.id ? updatedWork : item),
        evaluations: [...unrelated, ...newEvaluations],
        notifications: [...notifications, ...state.notifications],
      };
    }

    case 'SAVE_WRITTEN':
    case 'FINALIZE_WRITTEN': {
      const evaluation = state.evaluations.find((item) => item.id === action.evaluationId);
      if (!evaluation || evaluation.written.status === EVALUATION_STATUS.CLOSED) return state;
      const closing = action.type === 'FINALIZE_WRITTEN';
      const evaluations = state.evaluations.map((item) => item.id === action.evaluationId ? {
        ...item,
        written: {
          ...item.written,
          scores: clone(action.scores),
          observations: clone(action.observations ?? {}),
          status: closing ? EVALUATION_STATUS.CLOSED : EVALUATION_STATUS.DRAFT,
          updatedAt: now(),
          ...(closing ? { finalizedAt: now() } : {}),
        },
      } : item);
      let notifications = state.notifications;
      if (closing) {
        const interim = { ...state, evaluations };
        const work = state.works.find((item) => item.id === evaluation.workId);
        if (work && areWrittenReviewsClosed(interim, work)) {
          const commissionActors = state.actors.filter((actor) => actor.roles.includes('COMMISSION'));
          const generated = commissionActors.map((actor) => ({
            id: `notice-${Date.now()}-${actor.id}`, recipientId: actor.id, type: 'WRITTEN_COMPLETE', workId: work.id,
            title: 'Revisión escrita completada', message: `Los dos miembros completaron la revisión escrita de ${work.code}. Ya puede programar la sustentación.`,
            route: `/trabajos/${work.id}/sustentacion`, createdAt: now(), readAt: null,
          }));
          notifications = [...generated, ...notifications];
        }
      }
      return { ...state, evaluations, notifications };
    }

    case 'SCHEDULE_DEFENSE': {
      const work = state.works.find((item) => item.id === action.workId);
      if (!work || !areWrittenReviewsClosed(state, work)) return state;
      const schedule = { ...action.schedule, scheduledAt: now() };
      const notifications = work.tribunalIds
        .map((memberId) => notificationForPerson(state, memberId, {
          type: 'DEFENSE_SCHEDULED', workId: work.id, title: 'Sustentación programada',
          message: `Se ha programado la sustentación del trabajo ${work.code} para el ${schedule.date.split('-').reverse().join('/')} a las ${schedule.time}, ${schedule.room}.`,
          route: `/trabajos/${work.id}`,
        }))
        .filter(Boolean);
      return {
        ...state,
        works: state.works.map((item) => item.id === work.id ? { ...item, schedule } : item),
        notifications: [...notifications, ...state.notifications],
      };
    }

    case 'SAVE_ORAL':
    case 'FINALIZE_ORAL': {
      const evaluation = state.evaluations.find((item) => item.id === action.evaluationId);
      const existing = evaluation?.oralByStudent?.[action.studentId];
      if (!evaluation || existing?.status === EVALUATION_STATUS.CLOSED) return state;
      const closing = action.type === 'FINALIZE_ORAL';
      return {
        ...state,
        evaluations: state.evaluations.map((item) => item.id === action.evaluationId ? {
          ...item,
          oralByStudent: {
            ...item.oralByStudent,
            [action.studentId]: {
              ...existing,
              scores: clone(action.scores),
              observations: clone(action.observations ?? {}),
              status: closing ? EVALUATION_STATUS.CLOSED : EVALUATION_STATUS.DRAFT,
              updatedAt: now(),
              ...(closing ? { finalizedAt: now() } : {}),
            },
          },
        } : item),
      };
    }

    case 'MARK_RUBRIC_PRINTED':
      return {
        ...state,
        evaluations: state.evaluations.map((item) => item.id === action.evaluationId ? {
          ...item,
          oralByStudent: {
            ...item.oralByStudent,
            [action.studentId]: { ...item.oralByStudent[action.studentId], printedAt: item.oralByStudent[action.studentId]?.printedAt ?? now() },
          },
        } : item),
      };

    case 'MARK_NOTIFICATION_READ':
      return { ...state, notifications: state.notifications.map((item) => item.id === action.notificationId ? { ...item, readAt: item.readAt ?? now() } : item) };

    case 'MARK_ALL_NOTIFICATIONS_READ':
      return { ...state, notifications: state.notifications.map((item) => item.recipientId === state.currentActorId ? { ...item, readAt: item.readAt ?? now() } : item) };

    case 'RESET_PROTOTYPE':
      return createInitialState();

    default:
      return state;
  }
}

function loadState() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return createInitialState();
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed.works) || !Array.isArray(parsed.evaluations)) return createInitialState();
    return parsed;
  } catch {
    return createInitialState();
  }
}

export function PrototypeProvider({ children }) {
  const [state, rawDispatch] = useReducer(reducer, undefined, loadState);

  const dispatch = (action) => {
    rawDispatch(action);
  };

  // Persist after React commits a new state while keeping the reducer pure.
  useEffect(() => {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* Prototype remains usable without storage. */ }
  }, [state]);

  const currentActor = state.actors.find((actor) => actor.id === state.currentActorId) ?? state.actors[0];
  const currentPerson = state.people.find((person) => person.id === currentActor.personId);
  const value = {
    state,
    currentActor,
    currentPerson,
    dispatch,
    setCurrentActor: (actorId) => dispatch({ type: 'SET_CURRENT_ACTOR', actorId }),
    resetPrototype: () => dispatch({ type: 'RESET_PROTOTYPE' }),
  };

  return <PrototypeContext.Provider value={value}>{children}</PrototypeContext.Provider>;
}

export function usePrototype() {
  const context = useContext(PrototypeContext);
  if (!context) throw new Error('usePrototype debe usarse dentro de PrototypeProvider');
  return context;
}
