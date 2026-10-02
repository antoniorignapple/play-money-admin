import { latestVehicleReading } from './vehiclePeriod.js';

const plate = value => String(value || '').replace(/[^a-z0-9]/gi, '').toUpperCase();
export function recordMatchesVehicle(record, vehicle) {
  if (!record || !vehicle) return false;
  if (record.vehicle_id) return String(record.vehicle_id) === String(vehicle.id);
  const key = plate(vehicle.plate);
  return Boolean(key && (plate(record.vehicle_plate_snapshot) === key || plate(record.mezzo).includes(key)));
}

export function buildFleetReport(vehicles, records, selectedIds, today) {
  const selected = new Set(selectedIds.map(String));
  return vehicles.filter(v => v.active !== false && selected.has(String(v.id)))
    .map(vehicle => ({ id: vehicle.id, name: String(vehicle.name || '').toLocaleUpperCase('it-IT'),
      plate: String(vehicle.plate || '').toLocaleUpperCase('it-IT'),
      reading: latestVehicleReading(records.filter(r => !r.deleted_at && r.is_deleted !== true && recordMatchesVehicle(r, vehicle)), today) }));
}
