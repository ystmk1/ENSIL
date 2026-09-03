import { CREATURE_RECORDS, type CreatureRecord } from '../data/creatureRecords';
import type { UnitRef } from './types';

/**
 * 목업 ↔ 개체 매핑. 펌웨어는 슬롯 번호(UNIT 1~4)만 알면 되고, 개체 id 를 보내도 받아준다.
 *   1 → NO.01 eo-005 십자형 (스위치 → 네오픽셀 17구)
 *   2 → NO.02 eo-002 텐던    (PIR → 서보)
 *   3 → NO.03 eo-003 스피커  (카메라 → 앰프 스피커)
 *   4 → NO.04 eo-004 전구군  (무선 LED, 연결 미정)
 */
export function resolveUnit(unit: UnitRef | undefined): CreatureRecord | null {
  if (unit === undefined || unit === null) return null;
  if (typeof unit === 'number' || /^\d+$/.test(String(unit))) {
    return CREATURE_RECORDS[Number(unit) - 1] ?? null;
  }
  return CREATURE_RECORDS.find((record) => record.id === unit) ?? null;
}

export function unitSlot(record: CreatureRecord): number {
  return CREATURE_RECORDS.findIndex((candidate) => candidate.id === record.id) + 1;
}
