import {
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { useSortable, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Every reorderable list in the app (start game players, Wizard and table game
// settings seats) shares one drag feel and look: the whole row is the drag
// target. Pair rows with the `sortable-row` class; the lifted look lives in
// styles/components/sortable.css.

// Mouse drags start after a short move so clicks still go through
export const SORTABLE_POINTER_ACTIVATION = { distance: 5 };
// Touch drags start on a brief hold so the list can still be scrolled
export const SORTABLE_TOUCH_ACTIVATION = { delay: 200, tolerance: 6 };

// Sensors must not start a drag from the controls inside a row (name field,
// remove button, team select). A button marked data-drag-surface (e.g. the
// tap-to-pick-dealer row) still drags with mouse and touch.
const ignoringControls = (Sensor, controls) => class extends Sensor {
  static activators = Sensor.activators.map(({ eventName, handler }) => ({
    eventName,
    handler: (event, ...rest) => !event.nativeEvent.target?.closest?.(controls) && handler(event, ...rest),
  }));
};

// Mouse: click-drag anywhere but a control. Touch: long-press anywhere, even
// a text field - a tap still focuses it. Keyboard: space/enter on the focused row.
const RowMouseSensor = ignoringControls(MouseSensor, 'input, textarea, select, button:not([data-drag-surface])');
const RowTouchSensor = ignoringControls(TouchSensor, 'select, button:not([data-drag-surface])');
const RowKeyboardSensor = ignoringControls(KeyboardSensor, 'input, textarea, select, button');

/** The shared sensors for a DndContext whose rows use useSortableRow. */
export function useSortableRowSensors() {
  return useSensors(
    useSensor(RowMouseSensor, { activationConstraint: SORTABLE_POINTER_ACTIVATION }),
    useSensor(RowTouchSensor, { activationConstraint: SORTABLE_TOUCH_ACTIVATION }),
    useSensor(RowKeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
}

const LIFT_SCALE = 1.02;

/**
 * useSortable plus the shared row style: the dragged row lifts slightly.
 * @param {import('@dnd-kit/sortable').UseSortableArguments} options
 * @returns {ReturnType<typeof useSortable> & { style: object, className: string }}
 */
export function useSortableRow(options) {
  const sortable = useSortable(options);
  const { transform, transition, isDragging } = sortable;

  const rowTransform = isDragging
    ? { x: 0, y: 0, ...transform, scaleX: LIFT_SCALE, scaleY: LIFT_SCALE }
    : transform;

  return {
    ...sortable,
    style: {
      transform: CSS.Transform.toString(rowTransform),
      transition,
    },
    className: isDragging ? 'sortable-row is-dragging' : 'sortable-row',
  };
}
