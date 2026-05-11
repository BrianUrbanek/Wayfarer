import type { CohortAnchor } from '../model/types';

export function createDefaultCohorts(): CohortAnchor[] {
  return [
    {
      id: 'cohort-competitive',
      label: 'Competitive / Skill Expression',
      tags: ['Competitive', 'Skill Expression', 'Fast Sessions'],
      ratings: {},
      source: 'meta_moderator'
    },
    {
      id: 'cohort-roleplay',
      label: 'Roleplay / Social',
      tags: ['Roleplay', 'Social', 'Slow Sessions'],
      ratings: {},
      source: 'meta_moderator'
    },
    {
      id: 'cohort-brainrot',
      label: 'Brain Rot / Casual',
      tags: ['Brain Rot', 'Fast Sessions', 'Casual'],
      ratings: {},
      source: 'meta_moderator'
    },
    {
      id: 'cohort-exploration',
      label: 'Exploration / Narrative',
      tags: ['Exploration', 'Weird', 'Narrative', 'Low Pressure'],
      ratings: {},
      source: 'meta_moderator'
    },
    {
      id: 'cohort-tactical',
      label: 'Tactical / Team Coordination',
      tags: ['Tactical', 'Team Coordination', 'Systems Mastery'],
      ratings: {},
      source: 'meta_moderator'
    }
  ];
}
