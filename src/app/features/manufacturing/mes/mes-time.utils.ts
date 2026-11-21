import { MesLiveTimes, MesPhase } from './mes.models';

/**
 * Advances the server times of a phase to the current instant. The server computed `times` as of `server_time`, with the
 * open interval counted up to then; the live counter only adds the seconds elapsed on this device since the board was
 * received to the category of the open interval, so a reload, a second tablet or a skewed clock shows the same numbers and
 * a suspended phase never accrues man or machine time.
 *
 * @param elapsedSeconds seconds elapsed on this device since the board was received (never negative)
 */
export function liveTimes(phase: MesPhase, elapsedSeconds: number): MesLiveTimes {
  const extra = Math.max(0, Math.floor(elapsedSeconds));
  const base: MesLiveTimes = {
    setup: phase.times.setup_seconds,
    run: phase.times.run_seconds,
    downtime: phase.times.downtime_seconds,
    man: phase.times.man_seconds,
    machine: phase.times.machine_seconds,
  };
  const open = phase.open_interval;
  if (open === null || phase.status === 'closed') {
    return base;
  }

  switch (open.category) {
    case 'setup':
      return { ...base, setup: base.setup + extra, man: base.man + extra, machine: base.machine + extra };
    case 'run':
      return {
        ...base,
        run: base.run + extra,
        man: open.machine_attended ? base.man + extra : base.man,
        machine: base.machine + extra,
      };
    case 'suspension':
      return { ...base, downtime: base.downtime + extra };
  }
}

/** Seconds as `HH:MM:SS` (hours are not capped at 24). */
export function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;

  return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':');
}

/** Stable key of a board row: the phase id, or the operation id of a row nobody took over. */
export function rowKey(phase: MesPhase): string {
  return phase.id ?? `op:${phase.operation.id}`;
}
