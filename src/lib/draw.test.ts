import { describe, it, expect } from 'vitest';
import { performDraw, type DrawConstraints, type DrawMember, type DrawExclusion } from './draw';

describe('Draw Engine', () => {
  const createMember = (id: string): DrawMember => ({
    id,
    participant_id: id,
    anonymous_name: `Member ${id}`
  });

  const createExclusion = (giverId: string, blockedId: string): DrawExclusion => ({
    giver_id: giverId,
    blocked_id: blockedId
  });

  describe('Basic functionality', () => {
    it('should handle minimum viable group (2 members)', () => {
      const constraints: DrawConstraints = {
        members: [createMember('A'), createMember('B')],
        exclusions: [],
        antiRecurrence: new Map()
      };

      const result = performDraw(constraints);

      expect(result.success).toBe(true);
      expect(result.assignments).toHaveLength(2);
      expect(result.assignments![0].giver_id).not.toBe(result.assignments![0].receiver_id);
      expect(result.assignments![1].giver_id).not.toBe(result.assignments![1].receiver_id);
    });

    it('should reject single member group', () => {
      const constraints: DrawConstraints = {
        members: [createMember('A')],
        exclusions: [],
        antiRecurrence: new Map()
      };

      const result = performDraw(constraints);

      expect(result.success).toBe(false);
      expect(result.error).toContain('almeno 2 partecipanti');
    });

    it('should handle normal group of 4', () => {
      const constraints: DrawConstraints = {
        members: [
          createMember('A'),
          createMember('B'), 
          createMember('C'),
          createMember('D')
        ],
        exclusions: [],
        antiRecurrence: new Map()
      };

      const result = performDraw(constraints);

      expect(result.success).toBe(true);
      expect(result.assignments).toHaveLength(4);
      
      // Check no self-assignments
      result.assignments!.forEach(assignment => {
        expect(assignment.giver_id).not.toBe(assignment.receiver_id);
      });

      // Check all members are assigned exactly once as givers and receivers
      const givers = result.assignments!.map(a => a.giver_id).sort();
      const receivers = result.assignments!.map(a => a.receiver_id).sort();
      const memberIds = ['A', 'B', 'C', 'D'].sort();
      
      expect(givers).toEqual(memberIds);
      expect(receivers).toEqual(memberIds);
    });
  });

  describe('Exclusions', () => {
    it('should respect simple exclusions', () => {
      const constraints: DrawConstraints = {
        members: [
          createMember('A'),
          createMember('B'),
          createMember('C')
        ],
        exclusions: [createExclusion('A', 'B')],
        antiRecurrence: new Map()
      };

      const result = performDraw(constraints);

      expect(result.success).toBe(true);
      expect(result.assignments).toHaveLength(3);
      
      // A should not be assigned to B
      const aAssignment = result.assignments!.find(a => a.giver_id === 'A');
      expect(aAssignment?.receiver_id).not.toBe('B');
    });

    it('should handle impossible exclusions scenario', () => {
      const constraints: DrawConstraints = {
        members: [createMember('A'), createMember('B')],
        exclusions: [
          createExclusion('A', 'B'),
          createExclusion('B', 'A')
        ],
        antiRecurrence: new Map()
      };

      const result = performDraw(constraints);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Impossibile completare');
    });

    it('should handle heavy exclusions with 4 members', () => {
      const constraints: DrawConstraints = {
        members: [
          createMember('A'),
          createMember('B'),
          createMember('C'),
          createMember('D')
        ],
        exclusions: [
          createExclusion('A', 'B'),
          createExclusion('B', 'A'),
          createExclusion('C', 'D')
        ],
        antiRecurrence: new Map()
      };

      const result = performDraw(constraints);

      expect(result.success).toBe(true);
      expect(result.assignments).toHaveLength(4);
      
      // Verify exclusions are respected
      result.assignments!.forEach(assignment => {
        if (assignment.giver_id === 'A') {
          expect(assignment.receiver_id).not.toBe('B');
        }
        if (assignment.giver_id === 'B') {
          expect(assignment.receiver_id).not.toBe('A');
        }
        if (assignment.giver_id === 'C') {
          expect(assignment.receiver_id).not.toBe('D');
        }
      });
    });
  });

  describe('Anti-recurrence', () => {
    it('should avoid last year assignments', () => {
      const antiRecurrence = new Map([
        ['A', 'B'],  // A gave to B last year
        ['B', 'C']   // B gave to C last year
      ]);

      const constraints: DrawConstraints = {
        members: [
          createMember('A'),
          createMember('B'),
          createMember('C')
        ],
        exclusions: [],
        antiRecurrence
      };

      const result = performDraw(constraints);

      expect(result.success).toBe(true);
      expect(result.assignments).toHaveLength(3);
      
      // Check anti-recurrence is respected
      const aAssignment = result.assignments!.find(a => a.giver_id === 'A');
      const bAssignment = result.assignments!.find(a => a.giver_id === 'B');
      
      expect(aAssignment?.receiver_id).not.toBe('B');
      expect(bAssignment?.receiver_id).not.toBe('C');
    });

    it('should handle anti-recurrence with exclusions', () => {
      const antiRecurrence = new Map([['A', 'C']]);

      const constraints: DrawConstraints = {
        members: [
          createMember('A'),
          createMember('B'),
          createMember('C')
        ],
        exclusions: [createExclusion('A', 'B')], // A can't give to B
        antiRecurrence // A also can't give to C (last year)
      };

      // A can only give to A (self), which is not allowed
      const result = performDraw(constraints);
      expect(result.success).toBe(false);
    });
  });

  describe('Edge cases', () => {
    it('should handle duplicate member IDs', () => {
      const constraints: DrawConstraints = {
        members: [
          createMember('A'),
          createMember('A') // Duplicate
        ],
        exclusions: [],
        antiRecurrence: new Map()
      };

      const result = performDraw(constraints);

      expect(result.success).toBe(false);
      expect(result.error).toContain('duplicati');
    });

    it('should work with larger group (6 members)', () => {
      const constraints: DrawConstraints = {
        members: [
          createMember('A'),
          createMember('B'),
          createMember('C'),
          createMember('D'),
          createMember('E'),
          createMember('F')
        ],
        exclusions: [
          createExclusion('A', 'B'),
          createExclusion('C', 'D'),
          createExclusion('E', 'F')
        ],
        antiRecurrence: new Map([
          ['A', 'F'],
          ['B', 'E']
        ])
      };

      const result = performDraw(constraints);

      expect(result.success).toBe(true);
      expect(result.assignments).toHaveLength(6);
      
      // Verify all constraints
      result.assignments!.forEach(assignment => {
        expect(assignment.giver_id).not.toBe(assignment.receiver_id);
      });

      // Check exclusions and anti-recurrence
      const aAssignment = result.assignments!.find(a => a.giver_id === 'A');
      expect(aAssignment?.receiver_id).not.toBe('B'); // exclusion
      expect(aAssignment?.receiver_id).not.toBe('F'); // anti-recurrence
    });
  });
});