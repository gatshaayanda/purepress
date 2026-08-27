"use client";

import type { PurePressCustomerOrderProjection } from "../customerProjection";
import {
  deletePurePressOfflineRecord,
  getPurePressOfflineRecord,
  listPurePressOfflineRecords,
  purePressOfflineKey,
  putPurePressOfflineRecord,
} from "./db";

const TRUST_KIND = "customer-trusted-device";
const ORDER_KIND = "customer-order";

function trustedKey(uid: string) {
  return purePressOfflineKey(uid, TRUST_KIND);
}

function orderKey(uid: string, projectId: string) {
  return purePressOfflineKey(uid, ORDER_KIND, projectId);
}

export async function isPurePressCustomerTrustedDevice(uid: string) {
  const record = await getPurePressOfflineRecord<{ enabled: true }>("meta", trustedKey(uid), uid);
  return record?.value.enabled === true;
}

export async function setPurePressCustomerTrustedDevice(uid: string, enabled: boolean) {
  if (!enabled) {
    await clearPurePressCustomerOrderCache(uid);
    await deletePurePressOfflineRecord("meta", trustedKey(uid));
    return;
  }
  await putPurePressOfflineRecord("meta", {
    key: trustedKey(uid),
    uid,
    value: { enabled: true as const },
    savedAt: Date.now(),
  });
}

export async function savePurePressCustomerOrders(uid: string, orders: PurePressCustomerOrderProjection[]) {
  if (!(await isPurePressCustomerTrustedDevice(uid))) return;
  await Promise.all(orders.map((order) => putPurePressOfflineRecord("orders", {
    key: orderKey(uid, order.projectId),
    uid,
    value: order,
    savedAt: Date.now(),
  })));
}

export async function savePurePressCustomerOrder(uid: string, order: PurePressCustomerOrderProjection) {
  if (!(await isPurePressCustomerTrustedDevice(uid))) return;
  await putPurePressOfflineRecord("orders", {
    key: orderKey(uid, order.projectId),
    uid,
    value: order,
    savedAt: Date.now(),
  });
}

export async function loadPurePressCustomerOrders(uid: string) {
  if (!(await isPurePressCustomerTrustedDevice(uid))) return [];
  const records = await listPurePressOfflineRecords<PurePressCustomerOrderProjection>("orders", uid);
  return records
    .filter((record) => record.key.startsWith(`${uid}:${ORDER_KIND}:`))
    .sort((a, b) => b.savedAt - a.savedAt);
}

export async function loadPurePressCustomerOrder(uid: string, projectId: string) {
  if (!(await isPurePressCustomerTrustedDevice(uid))) return undefined;
  return getPurePressOfflineRecord<PurePressCustomerOrderProjection>("orders", orderKey(uid, projectId), uid);
}

export async function clearPurePressCustomerOrderCache(uid: string) {
  if (!uid.trim()) return;
  const records = await listPurePressOfflineRecords<unknown>("orders", uid);
  await Promise.all(records
    .filter((record) => record.key.startsWith(`${uid}:${ORDER_KIND}:`))
    .map((record) => deletePurePressOfflineRecord("orders", record.key)));
}

export async function clearPurePressCustomerOfflineData(uid: string) {
  await clearPurePressCustomerOrderCache(uid);
  if (uid.trim()) await deletePurePressOfflineRecord("meta", trustedKey(uid));
}
