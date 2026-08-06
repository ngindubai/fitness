import { test } from 'node:test'
import assert from 'node:assert/strict'

import { PLANS } from '../src/data/plans.js'
import { MOVEMENTS, findMovement } from '../public/movements.js'

// Titles that legitimately have no form guide.
const NO_GUIDE_OK = [
  /photos/i,          // test-week photo comparison
  /5 km walk/i,       // plain outdoor walking
  /steady cardio/i,   // machine choice left open — matched via 'steady cardio' pattern actually
]

test('every prescribed exercise in both plans has a movement guide', () => {
  const missing = []
  for (const plan of Object.values(PLANS)) {
    for (const phase of plan.phases) {
      for (const session of phase.sessions) {
        for (const exercise of session.exercises) {
          if (!findMovement(exercise.name)) missing.push(`${plan.id}: ${exercise.name}`)
        }
      }
    }
    for (const exercise of plan.testSession.exercises) {
      if (!findMovement(exercise.name) && !NO_GUIDE_OK.some((rx) => rx.test(exercise.name))) {
        missing.push(`${plan.id} test week: ${exercise.name}`)
      }
    }
  }
  assert.deepEqual(missing, [], `no guide for: ${missing.join(' | ')}`)
})

test('gym-day cardio titles resolve to sensible guides', () => {
  assert.equal(findMovement('Incline walk — 12 min').id, 'incline_walk')
  assert.equal(findMovement('Rowing machine finisher').id, 'rowing_machine')
  assert.equal(findMovement('Easy run — 20–30 min').id, 'running')
  assert.equal(findMovement('Hills or intervals — 6–8 × 60–90 s uphill').id, 'running')
  assert.equal(findMovement('2,000 m row — fastest time').id, 'rowing_machine')
})

test('longest pattern wins for overlapping names', () => {
  assert.equal(findMovement('Single-leg Romanian deadlift').id, 'single_leg_rdl')
  assert.equal(findMovement('Romanian deadlift').id, 'rdl')
  assert.equal(findMovement('Bulgarian split squat').id, 'bulgarian_split_squat')
  assert.equal(findMovement('Split squat').id, 'split_squat')
  assert.equal(findMovement('Side plank — longest hold').id, 'side_plank')
  assert.equal(findMovement('Plank — longest hold').id, 'plank')
})

test('every movement is complete: instructions and a well-formed animation', () => {
  for (const movement of MOVEMENTS) {
    assert.ok(movement.feel && movement.setup && movement.cue, `${movement.id} instruction text`)
    assert.ok(movement.steps.length >= 3, `${movement.id} steps`)
    assert.ok(movement.wrong.length >= 3, `${movement.id} faults`)

    const anim = movement.anim
    assert.ok(anim.poses.length >= 2, `${movement.id} needs at least two poses`)
    assert.ok(anim.phases.length >= 2, `${movement.id} needs phases`)
    for (const phase of anim.phases) {
      assert.ok(anim.poses[phase.pose], `${movement.id} phase points at pose ${phase.pose}`)
      assert.ok(phase.dur >= 200, `${movement.id} phase duration`)
      assert.ok(phase.label, `${movement.id} phases are captioned`)
    }
    for (const pose of anim.poses) {
      assert.ok(Array.isArray(pose.hip) && pose.ankles?.length === 2, `${movement.id} pose shape`)
      // Everything must stay inside the 240×190 canvas.
      const points = [pose.hip, ...pose.ankles, ...(pose.wristsRel ? [] : pose.wrists || [])].filter(Boolean)
      for (const [x, y] of points) {
        assert.ok(x >= 0 && x <= 240 && y >= 0 && y <= 190, `${movement.id} point ${x},${y} off canvas`)
      }
    }
  }
})
