<template>
  <div class="home-page" :style="themeStyle">
    <div class="sticky-panel">
      <header class="page-header">
        <div class="brand">
          <img class="brand-logo" :src="logoUrl" alt="" aria-hidden="true" />
          <div class="brand-text">
            <h1>减肥冲刺！！！</h1>
            <span>共 {{ items.length }} 条记录</span>
          </div>
        </div>
        <div class="header-actions">
          <button v-if="showScrollTop" class="header-icon" type="button" aria-label="返回顶部" @click="scrollToTop">
            <el-icon><Top /></el-icon>
          </button>
          <button class="header-icon" type="button" aria-label="设置" :disabled="!recordsReady" @click="settingsPopup = true">
            <el-icon><Setting /></el-icon>
          </button>
        </div>
      </header>
    </div>

    <main class="sprint-view">
      <section class="day-panel" aria-labelledby="day-heading">
        <div class="day-heading">
          <h2 id="day-heading">每日记录</h2>
          <button v-if="!isToday" class="today-button" type="button" @click="selectedDate = today()">回到今天</button>
        </div>
        <div class="day-controls">
          <button type="button" aria-label="前一天" @click="changeDay(-1)">
            <el-icon><ArrowLeft /></el-icon>
          </button>
          <label class="date-picker">
            <el-icon><Calendar /></el-icon>
            <span>{{ selectedDateLabel }}</span>
            <input :value="selectedDate" type="date" aria-label="选择记录日期" @click="openDatePicker" @change="selectDate" />
          </label>
          <button type="button" aria-label="后一天" @click="changeDay(1)">
            <el-icon><ArrowRight /></el-icon>
          </button>
        </div>

        <div class="summary-grid">
          <div
            v-for="card in summaryCards"
            :key="card.kind"
            class="summary-card"
          >
            <button class="summary-main" type="button" :disabled="!recordsReady" @click="openEditor(card.kind)">
              <span class="summary-top">
                <span class="summary-icon" :class="card.kind"><el-icon><component :is="card.icon" /></el-icon></span>
                <span class="summary-label">{{ labels[card.kind] }}</span>
              </span>
              <strong :class="{ placeholder: card.value === '—' }">{{ card.value }}<small v-if="card.unit">{{ card.unit }}</small></strong>
              <span class="summary-action"><el-icon><Plus /></el-icon>记录</span>
            </button>
            <button class="summary-action camera-action" type="button" :disabled="!recordsReady"
              :aria-label="'拍照记录' + labels[card.kind]" @click="takePhoto(card.kind)">
              <el-icon><Camera /></el-icon>拍照
            </button>
          </div>
        </div>
        <input ref="cameraInput" type="file" accept="image/*" capture="environment" hidden @change="onPhotoSelected" />
        <input ref="galleryInput" type="file" accept="image/*" hidden @change="onPhotoSelected" />
      </section>

      <section class="log-panel" aria-labelledby="log-heading">
        <div class="log-heading">
          <h2 id="log-heading">当天明细</h2>
          <span>{{ dayRecords.length }} 条</span>
        </div>
        <div v-if="dayRecords.length" class="record-list">
          <div v-for="item in dayRecords" :key="item.id" class="record-entry">
            <button v-if="item.photo" class="record-thumbnail" type="button" aria-label="查看记录照片" @click="previewPhoto(item.photo)">
              <img :src="item.photo" alt="" loading="lazy" />
            </button>
            <button class="record-row" type="button" @click="openEditor(item.kind, item)">
              <span class="summary-icon" :class="item.kind"><el-icon><component :is="icons[item.kind]" /></el-icon></span>
              <strong class="record-copy">{{ recordTitle(item) }}</strong>
              <span class="record-kind" :class="item.kind">{{ item.kind === 'food' && item.meal ? mealLabels[item.meal] : labels[item.kind] }}</span>
              <el-icon class="record-arrow"><ArrowRight /></el-icon>
            </button>
          </div>
        </div>
        <div v-else class="empty-state">
          <el-icon class="empty-icon"><Calendar /></el-icon>
          <strong>这一天还没有记录</strong>
          <span>点击上方卡片，记下饮食、体重或运动</span>
        </div>
      </section>
      <section class="analysis-panel" aria-labelledby="analysis-heading">
        <div class="log-heading">
          <h2 id="analysis-heading">记录分析</h2>
          <span>截至今天</span>
        </div>

        <div class="analysis-section">
          <h3><span class="summary-icon weight"><el-icon><Odometer /></el-icon></span>体重变化</h3>
          <dl class="analysis-grid">
            <div v-for="period in weightAnalysis" :key="period.label" class="analysis-stat" :class="changeTone(period.change)">
              <dt>{{ period.label }}</dt>
              <dd>
                <template v-if="period.change === null">
                  <span class="analysis-empty">记录不足</span>
                </template>
                <template v-else>
                  <span class="analysis-value">
                    <el-icon v-if="period.change !== 0"><component :is="period.change < 0 ? Bottom : Top" /></el-icon>
                    {{ period.change === 0 ? "持平" : Math.abs(period.change) }}<small v-if="period.change !== 0">公斤</small>
                  </span>
                  <small class="analysis-dates">{{ period.dates }}</small>
                </template>
              </dd>
            </div>
          </dl>
          <p class="analysis-note">近 7 天 / 近 30 天内，首条与最新体重对比</p>
        </div>

        <div class="analysis-section">
          <h3><span class="summary-icon exercise"><el-icon><Timer /></el-icon></span>运动天数</h3>
          <dl class="analysis-grid exercise-analysis">
            <div class="analysis-stat">
              <dt>累计运动</dt>
              <dd><span class="analysis-value">{{ exerciseAnalysis.total }}<small>天</small></span></dd>
            </div>
            <div class="analysis-stat" :class="{ streak: exerciseAnalysis.streak > 0 }">
              <dt>连续运动</dt>
              <dd><span class="analysis-value">{{ exerciseAnalysis.streak }}<small>天</small></span></dd>
            </div>
          </dl>
          <p class="analysis-note">同一天多次运动计 1 天；今天未运动时从昨天起算连续天数</p>
        </div>
      </section>
    </main>

    <van-popup v-model:show="editorPopup" class="edit-popup" :close-on-click-overlay="!saving" round destroy-on-close>
      <form class="popup-body editor-form" @submit.prevent="saveItem">
        <div class="popup-head">
          <h3>{{ editingItemId ? "编辑" : "记录" }}{{ labels[form.kind] }}</h3>
          <button class="header-icon" type="button" aria-label="关闭" :disabled="saving" @click="editorPopup = false">
            <el-icon><Close /></el-icon>
          </button>
        </div>
        <div class="photo-field">
          <button v-if="form.photo" class="editor-photo" type="button" aria-label="查看记录照片" @click="previewPhoto(form.photo)">
            <img :src="form.photo" alt="" />
          </button>
          <div class="photo-actions">
            <button type="button" :disabled="photoBusy || saving" @click="takePhoto()"><el-icon><Camera /></el-icon>拍照</button>
            <button type="button" :disabled="photoBusy || saving" @click="galleryInput?.click()">从相册选图</button>
            <button v-if="form.photo" type="button" :disabled="saving" @click="removePhoto">移除照片</button>
          </div>
          <p v-if="photoStatus" class="photo-status" role="status">{{ photoStatus }}</p>
        </div>
        <label v-if="form.kind === 'food'">
          餐次
          <select v-model="form.meal">
            <option value="">请选择</option>
            <option v-for="(label, meal) in mealLabels" :key="meal" :value="meal">{{ label }}</option>
          </select>
        </label>
        <label v-if="form.kind !== 'weight'">
          {{ form.kind === "food" ? (form.photo ? "吃了什么（选填）" : "吃了什么") : "运动项目（选填）" }}
          <input v-model.trim="form.name" :required="form.kind === 'food' && !form.photo"
            :placeholder="form.kind === 'food' ? '例如：一碗燕麦粥、一个鸡蛋' : '例如：快走'" />
        </label>
        <label v-if="form.kind === 'weight'">
          体重（公斤）
          <input v-model.number="form.amount" type="number" inputmode="decimal" min="0.01" step="0.01" placeholder="例如：65.5" required />
        </label>
        <label v-if="form.kind === 'exercise'">
          运动时长（分钟）
          <input v-model.number="form.amount" type="number" inputmode="numeric" min="1" step="1" placeholder="例如：30"
            :required="form.distanceKm === '' && form.calories === ''" />
        </label>
        <div v-if="form.kind === 'exercise'" class="exercise-fields">
          <label>距离（公里）
            <input v-model.number="form.distanceKm" type="number" inputmode="decimal" min="0.01" step="any" />
          </label>
          <label>热量（千卡）
            <input v-model.number="form.calories" type="number" inputmode="decimal" min="0.01" step="any" />
          </label>
        </div>
        <div class="editor-actions">
          <button v-if="editingItemId" class="danger" type="button" :disabled="saving" @click="removeItem(editingItemId)">移入回收站</button>
          <button class="save-button" type="submit" :disabled="photoBusy || saving">保存</button>
        </div>
      </form>
    </van-popup>

    <SettingsPopup
      v-model:show="settingsPopup"
      :theme-options="themeOptions"
      :current-theme="currentTheme"
      :current-theme-name="currentThemeOption.name"
      :recycle-count="deletedItems.length"
      @set-theme="setTheme"
      @export="exportAllData"
      @open-import="openImportExport"
      @open-recycle="openRecycleBin"
      @reset="resetAllData"
    />

    <van-popup v-model:show="recyclePopup" position="bottom" round destroy-on-close>
      <div class="popup-body recycle-popup">
        <div class="popup-head">
          <div>
            <h3>回收站</h3>
            <p>移除的记录保留 7 天，可在这里恢复。</p>
          </div>
        </div>

        <div v-if="deletedItems.length" class="recycle-list">
          <div v-for="item in deletedItems" :key="item.id" class="recycle-item">
            <div>
              <strong>{{ recordTitle(item) }}</strong>
              <span>{{ item.recordedAt }} · {{ getRecycleDaysLeft(item) }} 天后清除</span>
            </div>
            <div class="recycle-actions">
              <button type="button" @click="restoreDeletedItem(item.id)">恢复</button>
              <button class="danger" type="button" @click="purgeDeletedItem(item.id)">删除</button>
            </div>
          </div>
        </div>

        <div v-else class="empty-state compact">
          <strong>回收站为空</strong>
          <span>移除的记录会在这里保留一周。</span>
        </div>
      </div>
    </van-popup>

    <ImportDataPopup
      v-model:show="importExportInfo.show"
      :record-count="items.length"
      :file-name="importInfo.fileName"
      :has-file="Boolean(importInfo.dataStr)"
      @file-loaded="onImportFileLoaded"
      @file-error="showToast"
      @import="importData"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from "vue";
import dayjs from "dayjs";
import { showConfirmDialog, showImagePreview, showToast } from "vant";
import { ArrowLeft, ArrowRight, Bottom, Calendar, Camera, Close, Food, Odometer, Plus, Setting, Timer, Top } from "@element-plus/icons-vue";
import ImportDataPopup from "@/components/ImportDataPopup.vue";
import SettingsPopup from "@/components/SettingsPopup.vue";
import { DEFAULT_THEME, isThemeKey, themeOptions, type ThemeKey } from "@/config/themes";
import { LStorage } from "@/utils/localStorage";
import { mealLabels, type DeletedSprintRecord, type Meal, type RecordKind, type SprintData, type SprintRecord } from "@/types/tool";
import { prepareRecordPhoto, recognizeRecordPhoto } from "@/utils/recordPhoto";
import { readStoredRecords, writeStoredRecords } from "@/utils/sprintStorage";
import logoUrl from "@/assets/weight-loss-sprint-icon.svg";

const PROJECT = "weight-loss-sprint";
const DATE_FORMAT = "YYYY-MM-DD";
const DAY_MS = 24 * 60 * 60 * 1000;
const RECYCLE_KEEP_MS = 7 * DAY_MS;
const labels = { food: "饮食", weight: "体重", exercise: "运动" };
const icons = { food: Food, weight: Odometer, exercise: Timer };
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

const dataStorage = LStorage.new(`${PROJECT}:records`);
const themeStorage = LStorage.new(`${PROJECT}:theme`);
let storedSnapshot: string | undefined;
const data = ref<SprintData>({ items: [], deletedItems: [] });
const recordsReady = ref(false);
const saving = ref(false);
const items = computed(() => data.value.items);
const deletedItems = computed(() => data.value.deletedItems.filter(isInRecycleWindow));
const currentTheme = ref<ThemeKey>(DEFAULT_THEME);
const currentThemeOption = computed(() => themeOptions.find((theme) => theme.key === currentTheme.value) ?? themeOptions[0]);
const themeStyle = computed(() => currentThemeOption.value.variables);
const analysisDate = ref(today());
const selectedDate = ref(analysisDate.value);
const showScrollTop = ref(false);
const settingsPopup = ref(false);
const recyclePopup = ref(false);
const editorPopup = ref(false);
const editingItemId = ref("");
let editorRecordDate = "";
const cameraInput = ref<HTMLInputElement>();
const galleryInput = ref<HTMLInputElement>();
const photoBusy = ref(false);
const photoStatus = ref("");
let cameraKind: RecordKind | undefined;
let photoAttempt = 0;
let photoRecognition: AbortController | undefined;
const form = reactive({
  kind: "food" as RecordKind,
  name: "",
  amount: "" as number | string,
  meal: "" as Meal | "",
  distanceKm: "" as number | string,
  calories: "" as number | string,
  photo: "",
});
watch(editorPopup, (shown) => {
  if (!shown) resetPhotoAttempt();
}, { flush: "sync" });
const importExportInfo = ref({ show: false });
const importInfo = ref({ dataStr: "", fileName: "" });

const dayRecords = computed(() =>
  items.value.filter((item) => item.recordedAt === selectedDate.value)
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)),
);
const isToday = computed(() => selectedDate.value === analysisDate.value);
const selectedDateLabel = computed(() => {
  const date = dayjs(selectedDate.value);
  const weekday = "日一二三四五六"[date.day()];
  const offset = date.diff(dayjs(analysisDate.value), "day");
  const relative = offset === 0 ? " · 今天" : offset === -1 ? " · 昨天" : offset === 1 ? " · 明天" : "";
  return `${date.format("M月D日")} 周${weekday}${relative}`;
});
const summaryCards = computed(() => {
  const weight = dayRecords.value.find((item) => item.kind === "weight");
  const foodCount = dayRecords.value.filter((item) => item.kind === "food").length;
  const minutes = dayRecords.value.reduce((total, item) => total + (item.kind === "exercise" ? item.minutes ?? 0 : 0), 0);
  return [
    { kind: "food", icon: icons.food, value: foodCount, unit: "条" },
    { kind: "weight", icon: icons.weight, value: weight?.kilograms ?? "—", unit: weight ? "公斤" : "" },
    { kind: "exercise", icon: icons.exercise, value: minutes, unit: "分钟" },
  ] as const;
});

const weightAnalysis = computed(() => {
  const weights = items.value
    .filter((item) => item.kind === "weight")
    .filter((item) => item.recordedAt <= analysisDate.value)
    .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt) || Date.parse(a.updatedAt) - Date.parse(b.updatedAt));
  const latest = weights[weights.length - 1];
  const end = dayjs(analysisDate.value);
  const periods = [
    { label: "近一周", start: end.subtract(6, "day").format(DATE_FORMAT) },
    { label: "近一月", start: end.subtract(29, "day").format(DATE_FORMAT) },
    { label: "较最初", start: weights[0]?.recordedAt },
  ];

  return periods.map(({ label, start }) => {
    const first = start && weights.find((item) => item.recordedAt >= start);
    if (!first || !latest || first === latest) return { label, change: null, dates: "" };
    const change = Number((latest.kilograms - first.kilograms).toFixed(2));
    const dateLabel = (date: string) => dayjs(date).format("M月D日");
    return {
      label,
      change,
      dates: `${dateLabel(first.recordedAt)} – ${dateLabel(latest.recordedAt)}`,
    };
  });
});

const exerciseAnalysis = computed(() => {
  const date = analysisDate.value;
  const exerciseDays = new Set(items.value
    .filter((item) => item.kind === "exercise" && item.recordedAt <= date)
    .map((item) => item.recordedAt));
  let day = dayjs(date);
  if (!exerciseDays.has(date)) day = day.subtract(1, "day");
  let streak = 0;
  while (exerciseDays.has(day.format(DATE_FORMAT))) {
    streak += 1;
    day = day.subtract(1, "day");
  }
  return { total: exerciseDays.size, streak };
});

function changeTone(change: number | null) {
  if (change === null) return "empty";
  if (change < 0) return "down";
  if (change > 0) return "up";
  return "flat";
}

function today() {
  return dayjs().format(DATE_FORMAT);
}

function isRecordDate(value: unknown): value is string {
  return typeof value === "string" && datePattern.test(value) && dayjs(value).format(DATE_FORMAT) === value;
}

function selectDate(event: Event) {
  const input = event.target as HTMLInputElement;
  if (isRecordDate(input.value)) selectedDate.value = input.value;
  else input.value = selectedDate.value;
}

function openDatePicker(event: MouseEvent) {
  const input = event.currentTarget as HTMLInputElement;
  try {
    input.showPicker?.();
  } catch {
    input.focus();
  }
}

function changeDay(offset: number) {
  const date = dayjs(selectedDate.value).add(offset, "day").format(DATE_FORMAT);
  if (isRecordDate(date)) selectedDate.value = date;
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isPhoto(value: unknown): value is string {
  return typeof value === "string" && /^data:image\/jpeg;base64,[a-z0-9+/]+=*$/i.test(value);
}

function isSprintRecord(value: unknown): value is SprintRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  if (
    typeof record.id !== "string" || !record.id ||
    !isRecordDate(record.recordedAt) || typeof record.note !== "string" ||
    typeof record.updatedAt !== "string" || !Number.isFinite(Date.parse(record.updatedAt)) ||
    (record.photo !== undefined && !isPhoto(record.photo))
  ) return false;
  switch (record.kind) {
    case "food":
      return typeof record.name === "string" && Boolean(record.name.trim() || record.photo) &&
        (record.meal === undefined || (typeof record.meal === "string" && Object.prototype.hasOwnProperty.call(mealLabels, record.meal)));
    case "weight":
      return isPositiveNumber(record.kilograms);
    case "exercise":
      return typeof record.name === "string" &&
        (record.minutes === undefined || (isPositiveNumber(record.minutes) && Number.isSafeInteger(record.minutes))) &&
        (record.distanceKm === undefined || isPositiveNumber(record.distanceKm)) &&
        (record.calories === undefined || isPositiveNumber(record.calories)) &&
        Boolean(record.minutes ?? record.distanceKm ?? record.calories);
    default:
      return false;
  }
}

function isDeletedRecord(value: unknown): value is DeletedSprintRecord {
  return isSprintRecord(value) && "deletedAt" in value &&
    typeof value.deletedAt === "string" && Number.isFinite(Date.parse(value.deletedAt));
}

function isSprintData(value: unknown): value is SprintData {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<SprintData>;
  return Array.isArray(candidate.items) && candidate.items.every((item) => isSprintRecord(item) && !("deletedAt" in item)) &&
    Array.isArray(candidate.deletedItems) && candidate.deletedItems.every(isDeletedRecord);
}

async function loadRecords() {
  try {
    storedSnapshot = await readStoredRecords();
    const stored: unknown = storedSnapshot === undefined ? dataStorage.getter() : JSON.parse(storedSnapshot);
    if (stored !== undefined) {
      if (!isSprintData(stored)) throw new Error("Invalid records");
      data.value = stored;
    }
    recordsReady.value = true;
  } catch {
    showToast("读取本地记录失败");
  }
}

async function persist(next: SprintData) {
  if (!recordsReady.value || saving.value) return false;
  saving.value = true;
  try {
    const snapshot = JSON.stringify(next);
    if (!await writeStoredRecords(snapshot, storedSnapshot)) {
      showToast("其他页面已更新记录，请刷新后重试");
      return false;
    }
    storedSnapshot = snapshot;
    data.value = next;
    return true;
  } catch {
    showToast("保存失败，请检查浏览器存储空间");
    return false;
  } finally {
    saving.value = false;
  }
}

function setTheme(theme: ThemeKey) {
  try {
    themeStorage.setter(theme);
    currentTheme.value = theme;
  } catch {
    showToast("主题保存失败");
  }
}

function recordTitle(item: SprintRecord) {
  switch (item.kind) {
    case "food": return item.name || "饮食照片";
    case "weight": return `${item.kilograms} 公斤`;
    case "exercise": return [
      item.name,
      item.minutes && `${item.minutes} 分钟`,
      item.distanceKm && `${item.distanceKm} 公里`,
      item.calories && `${item.calories} 千卡`,
    ].filter(Boolean).join(" · ");
  }
}

function openEditor(kind: RecordKind, item?: SprintRecord) {
  resetPhotoAttempt();
  editingItemId.value = item?.id ?? "";
  form.kind = kind;
  form.name = item && item.kind !== "weight" ? item.name : "";
  form.amount = item?.kind === "weight" ? item.kilograms : (item?.kind === "exercise" ? item.minutes ?? "" : "");
  form.meal = item?.kind === "food" ? item.meal ?? "" : "";
  form.distanceKm = item?.kind === "exercise" ? item.distanceKm ?? "" : "";
  form.calories = item?.kind === "exercise" ? item.calories ?? "" : "";
  form.photo = item?.photo ?? "";
  editorRecordDate = item?.recordedAt ?? selectedDate.value;
  editorPopup.value = true;
}

function resetPhotoAttempt() {
  photoAttempt += 1;
  photoRecognition?.abort();
  photoRecognition = undefined;
  photoBusy.value = false;
  photoStatus.value = "";
}

function takePhoto(kind?: RecordKind) {
  cameraKind = kind;
  cameraInput.value?.click();
}

function removePhoto() {
  resetPhotoAttempt();
  form.photo = "";
}

function previewPhoto(photo: string) {
  showImagePreview({ images: [photo], showIndex: false, closeable: true, teleport: "body" });
}

async function onPhotoSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file || saving.value) return;
  if (input === cameraInput.value && cameraKind) openEditor(cameraKind);
  if (!editorPopup.value) return;

  const attempt = ++photoAttempt;
  const kind = form.kind;
  const original = { amount: form.amount, distanceKm: form.distanceKm, calories: form.calories };
  photoBusy.value = true;
  photoStatus.value = "正在读取照片…";
  try {
    const photo = await prepareRecordPhoto(file);
    if (attempt !== photoAttempt) return;
    form.photo = photo;
    if (kind === "food") {
      photoStatus.value = "";
      return;
    }
    photoStatus.value = "正在识别照片…";
    photoRecognition = new AbortController();
    try {
      const result = await recognizeRecordPhoto(photo, kind, photoRecognition.signal);
      if (attempt !== photoAttempt) return;
      let filled = false;
      for (const field of ["amount", "distanceKm", "calories"] as const) {
        const value = result[field];
        if (value !== undefined && form[field] === original[field]) {
          form[field] = value;
          filled = true;
        }
      }
      photoStatus.value = filled ? "已填入识别结果，保存前请核对。" : "未自动填入数据，可以手动填写。";
    } catch {
      if (attempt === photoAttempt) photoStatus.value = "识别失败，照片已保留，可以手动填写。";
    }
  } catch {
    if (attempt === photoAttempt) photoStatus.value = "无法读取这张照片，请重新拍照或选择图片。";
  } finally {
    if (attempt === photoAttempt) {
      photoRecognition = undefined;
      photoBusy.value = false;
    }
  }
}

async function saveItem() {
  if (photoBusy.value || saving.value) return;
  const amount = Number(form.amount);
  const previous = items.value.find((record) => record.id === editingItemId.value);
  const base = {
    id: editingItemId.value || (window.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`),
    recordedAt: editorRecordDate,
    note: previous?.note ?? "",
    updatedAt: new Date().toISOString(),
    photo: form.photo || undefined,
  };
  let item: SprintRecord;
  switch (form.kind) {
    case "food":
      item = { ...base, kind: "food", name: form.name, meal: form.meal || undefined };
      break;
    case "weight":
      item = { ...base, kind: "weight", kilograms: amount };
      break;
    case "exercise":
      item = {
        ...base,
        kind: "exercise",
        name: form.name,
        minutes: form.amount === "" ? undefined : amount,
        distanceKm: form.distanceKm === "" ? undefined : Number(form.distanceKm),
        calories: form.calories === "" ? undefined : Number(form.calories),
      };
      break;
  }
  if (!isSprintRecord(item)) {
    showToast("请填写有效的记录内容");
    return;
  }
  const nextItems = [item, ...items.value.filter((record) => record.id !== item.id)];
  if (!await persist({ items: nextItems, deletedItems: deletedItems.value })) return;
  selectedDate.value = item.recordedAt;
  editorPopup.value = false;
  showToast("已保存");
}

async function removeItem(id: string) {
  const target = items.value.find((item) => item.id === id);
  if (!target || !await confirmAction("移入回收站", `确认移除「${recordTitle(target)}」吗？`)) return;
  const deletedItem = { ...target, deletedAt: new Date().toISOString() };
  if (!await persist({
    items: items.value.filter((item) => item.id !== id),
    deletedItems: [deletedItem, ...deletedItems.value.filter((item) => item.id !== id)],
  })) return;
  editorPopup.value = false;
  showToast("已移入回收站");
}

async function openRecycleBin() {
  const remainingItems = data.value.deletedItems.filter(isInRecycleWindow);
  if (data.value.deletedItems.length !== remainingItems.length) {
    await persist({ items: items.value, deletedItems: remainingItems });
  }
  settingsPopup.value = false;
  recyclePopup.value = true;
}

function isInRecycleWindow(item: DeletedSprintRecord) {
  return Date.now() - Date.parse(item.deletedAt) < RECYCLE_KEEP_MS;
}

function getRecycleDaysLeft(item: DeletedSprintRecord) {
  const elapsed = Math.max(0, Date.now() - Date.parse(item.deletedAt));
  return Math.max(1, Math.ceil((RECYCLE_KEEP_MS - elapsed) / DAY_MS));
}

async function restoreDeletedItem(id: string) {
  const item = deletedItems.value.find((record) => record.id === id);
  if (!item || !isInRecycleWindow(item)) {
    showToast("这条记录已超过恢复期限");
    return;
  }
  const { deletedAt: _deletedAt, ...restored } = item;
  if (!await persist({
    items: [{ ...restored, updatedAt: new Date().toISOString() }, ...items.value.filter((record) => record.id !== id)],
    deletedItems: deletedItems.value.filter((record) => record.id !== id),
  })) return;
  selectedDate.value = item.recordedAt;
  recyclePopup.value = false;
  showToast("记录已恢复");
}

async function purgeDeletedItem(id: string) {
  if (!await confirmAction("彻底删除", "确认彻底删除这条记录吗？")) return;
  if (await persist({ items: items.value, deletedItems: deletedItems.value.filter((item) => item.id !== id) })) {
    showToast("已彻底删除");
  }
}

function openImportExport() {
  settingsPopup.value = false;
  importInfo.value = { dataStr: "", fileName: "" };
  importExportInfo.value.show = true;
}

function exportAllData() {
  const backup = { project: PROJECT, items: items.value, deletedItems: data.value.deletedItems.filter(isInRecycleWindow) };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const downloadLink = document.createElement("a");
  downloadLink.href = url;
  downloadLink.download = `${PROJECT}-backup-${today()}.json`;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  downloadLink.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  settingsPopup.value = false;
  showToast("备份文件已导出");
}

function onImportFileLoaded(payload: { dataStr: string; fileName: string }) {
  importInfo.value = payload;
  showToast("备份文件已读取");
}

async function importData() {
  try {
    const backup: unknown = JSON.parse(importInfo.value.dataStr);
    if (!isSprintData(backup) || !("project" in backup) || backup.project !== PROJECT) {
      showToast("请选择本站导出的备份");
      return;
    }
    // Match by ID so repeated meals and workouts remain separate records.
    const latest = new Map<string, SprintRecord | DeletedSprintRecord>();
    const changeTime = (item: SprintRecord | DeletedSprintRecord) =>
      Date.parse("deletedAt" in item ? item.deletedAt : item.updatedAt);
    for (const item of [...data.value.items, ...data.value.deletedItems, ...backup.items, ...backup.deletedItems]) {
      const previous = latest.get(item.id);
      if (!previous || changeTime(item) > changeTime(previous)) latest.set(item.id, item);
    }
    const next: SprintData = { items: [], deletedItems: [] };
    for (const item of latest.values()) {
      if ("deletedAt" in item) {
        if (isInRecycleWindow(item)) next.deletedItems.push(item);
      } else {
        next.items.push(item);
      }
    }
    if (!await persist(next)) return;
    importExportInfo.value.show = false;
    importInfo.value = { dataStr: "", fileName: "" };
    showToast("备份已合并");
  } catch {
    showToast("导入失败，请检查备份文件");
  }
}

function confirmAction(title: string, message: string) {
  return showConfirmDialog({ title, message, width: "280px" }).then(() => true, () => false);
}

async function resetAllData() {
  if (!await confirmAction("重置数据", "确认清除所有饮食、体重、运动和回收站记录吗？")) return;
  if (!await persist({ items: [], deletedItems: [] })) return;
  settingsPopup.value = false;
  showToast("数据已重置");
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function updateScrollTopVisibility() {
  showScrollTop.value = window.scrollY > 240;
}

let analysisDateTimer: number | undefined;

onMounted(() => {
  void loadRecords();
  try {
    const storedTheme: unknown = themeStorage.getter();
    if (isThemeKey(storedTheme)) currentTheme.value = storedTheme;
  } catch {
    showToast("读取主题失败");
  }
  updateScrollTopVisibility();
  window.addEventListener("scroll", updateScrollTopVisibility, { passive: true });
  analysisDateTimer = window.setInterval(() => {
    analysisDate.value = today();
  }, 60_000);
});

onUnmounted(() => {
  resetPhotoAttempt();
  window.removeEventListener("scroll", updateScrollTopVisibility);
  window.clearInterval(analysisDateTimer);
});
</script>

<style lang="scss" scoped>
.home-page {
  min-height: 100vh;
  min-height: 100dvh;
  padding: 0 12px;
  background: var(--page-bg);
  color: var(--text-main);
}

.home-page,
.home-page * {
  box-sizing: border-box;
}

button, input, select {
  font: inherit;
}

button {
  cursor: pointer;
}

button:focus-visible, input:focus-visible, select:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.sticky-panel {
  --toolbar-inset: max(16px, calc((100% - 780px) / 2 + 4px));
  position: sticky;
  top: 0;
  z-index: 20;
  margin: 0 -12px;
  padding-top: env(safe-area-inset-top);
  background-color: var(--page-bg);
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 12px var(--toolbar-inset) 10px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.brand-logo {
  flex: 0 0 auto;
  width: 40px;
  height: 40px;
  border-radius: 11px;
  box-shadow: 0 4px 12px rgba(38, 56, 88, 0.1);
}

.brand-text {
  min-width: 0;
}

.brand-text h1 {
  margin: 0;
  color: var(--text-strong);
  font-size: 22px;
  line-height: 1.2;
  letter-spacing: -0.01em;
}

.brand-text span {
  display: block;
  margin-top: 2px;
  color: var(--text-muted);
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: 0;
  border-radius: 12px;
  background: var(--surface);
  box-shadow: 0 2px 10px rgba(20, 40, 62, 0.06);
  color: var(--accent);
  font-size: 18px;
  transition: background-color 0.15s ease, transform 0.15s ease;
}

.header-icon:active {
  transform: scale(0.94);
}

.recycle-popup {
  max-height: 78vh;
  overflow-y: auto;
}

.popup-head p {
  margin: 4px 0 0;
  color: var(--text-muted);
  font-size: 12px;
}

.recycle-list {
  display: grid;
  gap: 10px;
  margin-top: 14px;
}

.recycle-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  padding: 12px;
  border: 1px solid var(--divider);
  border-radius: 12px;
  background: var(--surface-soft);
}

.recycle-item strong,
.recycle-item span {
  display: block;
}

.recycle-item strong {
  color: var(--text-strong);
}

.recycle-item span {
  margin-top: 4px;
  color: var(--text-muted);
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recycle-actions {
  display: flex;
  gap: 8px;
}

.recycle-actions button {
  height: 34px;
  padding: 0 14px;
  border: 0;
  border-radius: 999px;
  background: var(--header-icon-bg);
  color: var(--accent);
  font-size: 13px;
  font-weight: 700;
}

.danger {
  background: var(--danger-bg) !important;
  color: var(--danger-text) !important;
}

.home-page :deep(.van-popup) {
  background: var(--surface);
  color: var(--text-main);
}

.sprint-view {
  width: min(100%, 780px);
  margin: 0 auto;
  padding: 20px 4px calc(16px + env(safe-area-inset-bottom));
}

.day-panel {
  position: relative;
  overflow: hidden;
  padding: clamp(16px, 4vw, 26px);
  border-radius: 24px;
  background: var(--stat-income-bg);
  box-shadow: 0 14px 30px rgba(15, 118, 110, 0.18), var(--stat-income-shadow);
  color: #fff;
}

.day-panel::after {
  content: "";
  position: absolute;
  top: -60px;
  right: -40px;
  width: 180px;
  height: 180px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.08);
  pointer-events: none;
}

.day-heading, .log-heading, .day-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.day-heading, .log-heading {
  justify-content: space-between;
}

.day-heading {
  position: relative;
  z-index: 1;
  min-height: 44px;
}

.day-heading h2, .log-heading h2 {
  margin: 0;
  font-size: 20px;
  line-height: 1.2;
}

.today-button {
  flex: none;
  height: 32px;
  padding: 0 12px;
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.16);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
}

.day-controls {
  position: relative;
  z-index: 1;
  gap: 4px;
  margin-top: 14px;
  padding: 4px;
  border: 1px solid rgba(255, 255, 255, 0.24);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.14);
}

.day-controls button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 40px;
  min-height: 40px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: #fff;
  font-size: 16px;
}

.date-picker {
  position: relative;
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-width: 0;
  min-height: 40px;
  padding: 0 8px;
  border-radius: 10px;
  color: #fff;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
}

.date-picker span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.date-picker input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
}

.date-picker:focus-within {
  outline: 2px solid rgba(255, 255, 255, 0.7);
  outline-offset: 0;
}

.day-controls button:active, .date-picker:active, .today-button:active {
  background: rgba(255, 255, 255, 0.24);
}

.summary-grid {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: clamp(8px, 2vw, 14px);
  margin-top: 14px;
}

.summary-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  padding: clamp(10px, 3vw, 16px);
  border: 0;
  border-radius: 16px;
  background: var(--surface);
  box-shadow: 0 6px 16px rgba(8, 60, 50, 0.12);
}

.summary-main {
  display: grid;
  width: 100%;
  gap: 12px;
  padding: 0;
  border: 0;
  background: transparent;
  text-align: left;
}

.summary-top {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.summary-icon {
  display: inline-grid;
  place-items: center;
  flex: none;
  width: 34px;
  height: 34px;
  border-radius: 10px;
  font-size: 18px;
}

.summary-icon.food { background: #fff1df; color: #8c4e17; }
.summary-icon.weight { background: #e7f0ff; color: #26588e; }
.summary-icon.exercise { background: #e4f4e9; color: #256846; }

.summary-label {
  color: var(--text-subtle);
  font-size: 13px;
  font-weight: 600;
}

.summary-card strong {
  display: flex;
  align-items: baseline;
  gap: 3px;
  max-width: 100%;
  min-height: 32px;
  color: var(--text-strong);
  overflow-wrap: anywhere;
  font-size: clamp(22px, 5vw, 32px);
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
}

.summary-card strong.placeholder {
  color: var(--text-muted);
  font-weight: 500;
}

.summary-card small {
  color: var(--text-subtle);
  white-space: nowrap;
  font-size: 12px;
  font-weight: 500;
}

.summary-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  width: 100%;
  height: 30px;
  margin-top: auto;
  border: 0;
  border-radius: 999px;
  background: var(--header-icon-bg);
  color: var(--accent);
  font-size: 13px;
  font-weight: 700;
}

.camera-action {
  background: transparent;
  border: 1px solid var(--divider);
}

.log-panel, .analysis-panel {
  margin-top: 18px;
  padding: clamp(16px, 4vw, 24px);
  border-radius: 20px;
  background: var(--surface);
  box-shadow: var(--header-shadow);
}

.analysis-section {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--divider);
}

.analysis-panel h3 {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 10px;
  color: var(--text-strong);
  font-size: 15px;
}

.analysis-panel h3 .summary-icon {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  font-size: 15px;
}

.analysis-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin: 0;
}

.exercise-analysis {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.analysis-stat {
  min-width: 0;
  padding: 12px clamp(8px, 2.5vw, 14px);
  border-radius: 14px;
  background: var(--surface-soft);
}

.analysis-stat.down { background: #e9f6ef; }
.analysis-stat.up { background: #fff3e6; }
.analysis-stat.streak { background: #e9f6ef; }

.analysis-stat dt {
  color: var(--text-subtle);
  font-size: 12px;
  font-weight: 600;
}

.analysis-stat dd {
  display: grid;
  gap: 4px;
  margin: 8px 0 0;
}

.analysis-value {
  display: flex;
  align-items: baseline;
  gap: 2px;
  color: var(--text-strong);
  font-size: clamp(18px, 5vw, 24px);
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
  white-space: nowrap;
}

.analysis-value .el-icon {
  align-self: center;
  font-size: 0.75em;
}

.analysis-value small {
  margin-left: 2px;
  color: var(--text-subtle);
  font-size: 12px;
  font-weight: 500;
}

.analysis-stat.down .analysis-value, .analysis-stat.streak .analysis-value { color: #1f8a55; }
.analysis-stat.up .analysis-value { color: #c06a12; }

.analysis-empty {
  color: var(--text-muted);
  font-size: 14px;
  font-weight: 600;
  line-height: 26px;
}

.analysis-dates {
  overflow: hidden;
  color: var(--text-muted);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.analysis-note {
  margin: 8px 0 0;
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.5;
}

.log-heading > span {
  padding: 3px 10px;
  border-radius: 999px;
  background: var(--surface-muted);
  color: var(--text-subtle);
  font-size: 13px;
}

.empty-state {
  display: grid;
  justify-items: center;
  gap: 6px;
  margin: 14px 0 0;
  padding: 28px 12px;
  border: 1px dashed var(--divider);
  border-radius: 14px;
  background: var(--surface-soft);
  text-align: center;
}

.empty-icon {
  margin-bottom: 4px;
  color: var(--accent);
  font-size: 28px;
  opacity: 0.6;
}

.empty-state strong, .empty-state span {
  display: block;
}

.empty-state strong {
  color: var(--text-strong);
  font-size: 15px;
}

.empty-state span {
  color: var(--text-subtle);
  font-size: 13px;
}

.record-list {
  margin-top: 12px;
}

.record-entry {
  display: flex;
  align-items: center;
  gap: 8px;
  border-top: 1px solid var(--divider);
}

.record-row {
  display: flex;
  flex: 1;
  min-width: 0;
  align-items: center;
  width: 100%;
  gap: 10px;
  padding: 12px 4px;
  border: 0;
  background: var(--surface);
  color: var(--text-main);
  text-align: left;
}

.record-copy {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}

.record-kind, .record-arrow {
  flex: none;
}

.record-kind {
  padding: 3px 8px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
}

.record-kind.food { background: #fff1df; color: #8c4e17; }
.record-kind.weight { background: #e7f0ff; color: #26588e; }
.record-kind.exercise { background: #e4f4e9; color: #256846; }

.record-arrow {
  color: var(--text-muted);
}

.record-thumbnail, .editor-photo {
  display: block;
  flex: none;
  padding: 0;
  overflow: hidden;
  border: 0;
  border-radius: 10px;
  background: var(--field-bg);
}

.record-thumbnail img {
  display: block;
  width: 44px;
  height: 44px;
  object-fit: cover;
}

.edit-popup {
  width: min(calc(100% - 24px), 460px);
  max-height: calc(100dvh - 24px);
  overflow-y: auto;
}

.editor-form {
  display: grid;
  gap: 14px;
  padding: 20px;
}

.editor-form .popup-head {
  align-items: center;
}

.editor-form label {
  display: grid;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
}

.editor-form input, .editor-form select {
  width: 100%;
  min-height: 42px;
  padding: 9px 12px;
  border: 1px solid var(--divider);
  border-radius: 10px;
  background: var(--field-bg);
  color: var(--text-main);
  font-size: 16px;
  font-weight: 400;
}

.photo-field {
  display: grid;
  gap: 8px;
}

.editor-photo img {
  display: block;
  width: 100%;
  max-height: 150px;
  object-fit: contain;
}

.photo-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.photo-actions button {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 38px;
  padding: 6px 10px;
  border: 1px solid var(--divider);
  border-radius: 10px;
  background: var(--field-bg);
  color: var(--accent);
  font-size: 13px;
}

.photo-status {
  margin: 0;
  color: var(--text-subtle);
  font-size: 13px;
}

.exercise-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.editor-actions {
  display: flex;
  gap: 8px;
}

.editor-actions button {
  min-height: 42px;
  padding: 8px 12px;
  border: 0;
  border-radius: 10px;
  font-weight: 700;
}

.save-button {
  flex: 1;
  background: var(--submit-btn-bg);
  color: #fff;
}

@media (hover: hover) {
  .record-entry:hover, .record-row:hover, .summary-main:hover .summary-action, .camera-action:hover {
    background: var(--surface-soft);
  }
}

@media (max-width: 360px) {
  .summary-action {
    font-size: 12px;
  }

  .recycle-item {
    flex-wrap: wrap;
  }
}
</style>
