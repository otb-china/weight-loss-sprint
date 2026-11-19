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

    <main class="sprint-view" :class="{ dragging: pageDragging }" :style="pageStyle"
      @touchstart.passive="startDaySwipe" @touchmove="moveDaySwipe" @touchend="finishDaySwipe" @touchcancel="cancelDaySwipe">
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
              <span class="summary-icon" :class="card.kind"><el-icon><component :is="card.icon" /></el-icon></span>
              <strong :class="{ placeholder: card.value === '—' }">{{ card.value }}<small v-if="card.unit">{{ card.unit }}</small></strong>
              <span class="summary-foot">
                <span class="summary-label">{{ labels[card.kind] }}</span>
                <span class="summary-hint" :class="card.kind">记录<el-icon><ArrowRight /></el-icon></span>
              </span>
            </button>
            <button class="camera-action" :class="card.kind" type="button" :disabled="!recordsReady"
              :aria-label="'拍照记录' + labels[card.kind]" @click="takePhoto(card.kind)">
              <el-icon><Camera /></el-icon>
            </button>
          </div>
        </div>
        <input ref="cameraInput" type="file" accept="image/*" capture="environment" hidden @change="onPhotoSelected" />
        <input ref="galleryInput" type="file" accept="image/*" hidden @change="onPhotoSelected" />
      </section>

      <section class="analysis-panel" aria-labelledby="analysis-heading">
        <div class="log-heading">
          <h2 id="analysis-heading">记录分析</h2>
          <span>{{ analysisDateLabel }}</span>
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
                </template>
              </dd>
            </div>
          </dl>
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
        </div>
      </section>
      <section class="log-panel" aria-labelledby="log-heading">
        <div class="log-heading">
          <h2 id="log-heading">当天明细</h2>
          <span v-if="recordsReady">{{ dayRecords.length }} 条</span>
        </div>
        <div v-if="dayRecords.length || undoRecord" class="record-list">
          <div v-if="undoRecord" class="record-swipe"
            @pointerdown="startRecordSwipe($event, undoRecord.id, 'restore')"
            @pointermove="moveRecordSwipe" @pointerup="finishRecordSwipe" @pointercancel="cancelRecordSwipe"
            @click.capture="suppressSwipeClick">
            <button class="swipe-undo" type="button" :disabled="saving" @click="restoreDeletedItem(undoRecord.id)">
              已移入回收站 · 右滑或点击撤销
            </button>
          </div>
          <div v-for="item in dayRecords" :key="item.id" class="record-swipe"
            @pointerdown="startRecordSwipe($event, item.id, 'delete')"
            @pointermove="moveRecordSwipe" @pointerup="finishRecordSwipe" @pointercancel="cancelRecordSwipe"
            @click.capture="suppressSwipeClick">
            <span v-if="swipedRecordId === item.id && swipeOffset < 0" class="swipe-delete" aria-hidden="true">
              {{ swipeReady ? "松手删除" : "左滑删除" }}
            </span>
            <div class="record-entry" :class="{ swiping: swipedRecordId === item.id }"
              :style="swipedRecordId === item.id ? { transform: `translateX(${swipeOffset}px)` } : undefined">
              <button v-if="item.photoId" class="record-thumbnail" type="button" aria-label="查看记录照片" @click="previewPhoto('', item.photoId)">
                <img v-if="thumbnails.has(item.photoId)" :src="thumbnails.get(item.photoId)" alt="" loading="lazy" draggable="false" />
                <el-icon v-else><Camera /></el-icon>
              </button>
              <button class="record-row" :class="{ 'has-photo': item.photoId }" type="button" @click="openEditor(item.kind, item)">
                <span v-if="!item.photoId" class="summary-icon" :class="item.kind"><el-icon><component :is="icons[item.kind]" /></el-icon></span>
                <strong class="record-copy">{{ recordTitle(item) }}</strong>
                <span class="record-kind" :class="item.kind">{{ item.kind === 'food' && item.meal ? mealLabels[item.meal] : labels[item.kind] }}</span>
                <el-icon class="record-arrow"><ArrowRight /></el-icon>
              </button>
            </div>
          </div>
        </div>
        <div v-else class="empty-state">
          <el-icon class="empty-icon"><Calendar /></el-icon>
          <strong v-if="!recordsReady" role="status">{{ recordLoadError || "正在读取本地记录…" }}</strong>
          <template v-else>
            <strong>这一天还没有记录</strong>
            <span>点击上方卡片，记下饮食、体重或运动</span>
          </template>
        </div>
      </section>
    </main>

    <van-popup v-model:show="editorPopup" class="edit-popup" :close-on-click-overlay="!saving" round destroy-on-close>
      <form class="popup-body editor-form" novalidate @submit.prevent="saveItem">
        <div class="popup-head">
          <h3>{{ editingItemId ? "编辑" : "记录" }}{{ labels[form.kind] }}</h3>
          <button class="header-icon" type="button" aria-label="关闭" :disabled="saving" @click="editorPopup = false">
            <el-icon><Close /></el-icon>
          </button>
        </div>
        <div class="photo-field">
          <button v-if="form.photo || editorPhotoId" class="editor-photo" type="button" aria-label="查看记录照片" @click="previewPhoto(form.photo, editorPhotoId)">
            <img v-if="form.photo || thumbnails.has(editorPhotoId)" :src="form.photo || thumbnails.get(editorPhotoId)" alt="" />
            <el-icon v-else><Camera /></el-icon>
          </button>
          <div class="photo-actions">
            <button type="button" :disabled="photoBusy || saving" @click="takePhoto()"><el-icon><Camera /></el-icon>拍照</button>
            <button type="button" :disabled="photoBusy || saving" @click="galleryInput?.click()">从相册选图</button>
            <button v-if="(form.photo || editorPhotoId) && form.kind !== 'food'" type="button" :disabled="photoBusy || saving"
              @click="runPhotoRecognition()">重新识别</button>
            <button v-if="form.photo || editorPhotoId" type="button" :disabled="saving" @click="removePhoto">移除照片</button>
          </div>
          <p v-if="photoStatus" class="photo-status" role="status">{{ photoStatus }}</p>
        </div>
        <div v-if="form.kind === 'food'" class="meal-field" role="radiogroup" aria-labelledby="meal-field-label">
          <span id="meal-field-label" class="meal-field-label">餐次</span>
          <div class="meal-options">
            <button v-for="(label, meal) in mealLabels" :key="meal" type="button" role="radio"
              :class="{ active: form.meal === meal }" :aria-checked="form.meal === meal"
              @click="form.meal = meal">{{ label }}</button>
          </div>
        </div>
        <label v-if="form.kind === 'food'">
          {{ form.photo || editorPhotoId ? "吃了什么（选填）" : "吃了什么" }}
          <input v-model.trim="form.name" placeholder="例如：一碗燕麦粥、一个鸡蛋" />
        </label>
        <div v-if="form.kind === 'food' && frequentFoods.length" class="food-suggestions" role="group" aria-label="常吃的食物">
          <button v-for="name in frequentFoods" :key="name" type="button" :disabled="saving"
            @click="form.name = name">{{ name }}</button>
        </div>
        <div v-if="form.kind === 'exercise'" class="meal-field" role="radiogroup" aria-labelledby="exercise-field-label">
          <span id="exercise-field-label" class="meal-field-label">运动项目（选填）</span>
          <div class="meal-options">
            <button v-for="option in visibleExerciseOptions" :key="option" type="button" role="radio"
              :class="{ active: form.name === option }" :aria-checked="form.name === option"
              @click="selectExercise(option)">{{ option }}</button>
          </div>
        </div>
        <div v-if="form.kind === 'weight'" class="meal-field">
          <label for="weight-input" class="meal-field-label">体重（公斤）</label>
          <div class="weight-stepper">
            <button type="button" aria-label="减少 0.1 公斤" :disabled="saving" @click="stepWeight(-0.1)"><el-icon><Minus /></el-icon></button>
            <input id="weight-input" v-model.number="form.amount" type="number" inputmode="decimal" min="0.01" step="0.01" placeholder="例如：65.5" />
            <button type="button" aria-label="增加 0.1 公斤" :disabled="saving" @click="stepWeight(0.1)"><el-icon><Plus /></el-icon></button>
          </div>
        </div>
        <div v-if="form.kind === 'exercise'" class="exercise-fields">
          <label>时长（分钟）
            <input v-model.number="form.amount" type="number" inputmode="numeric" min="1" step="1" placeholder="30" />
          </label>
          <label>距离（公里）
            <input v-model.number="form.distanceKm" type="number" inputmode="decimal" min="0.01" step="any" />
          </label>
          <label>热量（千卡）
            <input v-model.number="form.calories" type="number" inputmode="decimal" min="0.01" step="any" />
          </label>
        </div>
        <div class="editor-actions">
          <button v-if="editingItemId" class="danger" type="button" :disabled="saving" @click="removeItem(editingItemId)">移入回收站</button>
          <button class="save-button" type="submit" :disabled="photoReading || saving || !canSave">保存</button>
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
import { computed, onMounted, onUnmounted, reactive, ref, shallowRef, watch } from "vue";
import dayjs from "dayjs";
import { showConfirmDialog, showImagePreview, showToast } from "vant";
import { ArrowLeft, ArrowRight, Bottom, Calendar, Camera, Close, Food, Minus, Odometer, Plus, Setting, Timer, Top } from "@element-plus/icons-vue";
import ImportDataPopup from "@/components/ImportDataPopup.vue";
import SettingsPopup from "@/components/SettingsPopup.vue";
import { DEFAULT_THEME, isThemeKey, themeOptions, type ThemeKey } from "@/config/themes";
import { LStorage } from "@/utils/localStorage";
import { mealLabels, type DeletedSprintRecord, type Meal, type RecordKind, type SprintData, type SprintRecord } from "@/types/tool";
import { photoBlobToData, prepareRecordPhoto, recognizeRecordPhoto } from "@/utils/recordPhoto";
import {
  readBackupPhotos, readPhoto, readStoredRecords, readThumbnail, RecordsUpgradeBlockedError,
  storeTheme, withoutInlinePhoto, writeStoredRecords,
} from "@/utils/sprintStorage";
import logoUrl from "@/assets/weight-loss-sprint-icon.svg";

const PROJECT = "weight-loss-sprint";
const DATE_FORMAT = "YYYY-MM-DD";
const DAY_MS = 24 * 60 * 60 * 1000;
const RECYCLE_KEEP_MS = 7 * DAY_MS;
const labels = { food: "饮食", weight: "体重", exercise: "运动" };
const icons = { food: Food, weight: Odometer, exercise: Timer };
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

const dataStorage = LStorage.new(`${PROJECT}:records`);
let savingTheme = false;
let storedRevision: number | undefined;
const data = shallowRef<SprintData>({ items: [], deletedItems: [] });
const recordsReady = ref(false);
const recordLoadError = ref("");
const saving = ref(false);
let exporting = false;
let previewing = false;
let previewUrl: string | undefined;
let unmounted = false;
const items = computed(() => data.value.items);
const deletedItems = computed(() => data.value.deletedItems.filter(isInRecycleWindow));
const currentTheme = ref<ThemeKey>(DEFAULT_THEME);
const currentThemeOption = computed(() => themeOptions.find((theme) => theme.key === currentTheme.value) ?? themeOptions[0]);
const themeStyle = computed(() => currentThemeOption.value.variables);
const todayDate = ref(today());
const selectedDate = ref(todayDate.value);
const lastSwipeDeletedId = ref("");
const undoRecord = computed(() => deletedItems.value.find((item) =>
  item.id === lastSwipeDeletedId.value && item.recordedAt === selectedDate.value));
const swipedRecordId = ref("");
const swipeOffset = ref(0);
const swipeReady = ref(false);
let activeSwipe: {
  id: string;
  action: "delete" | "restore";
  pointerId: number;
  startX: number;
  startY: number;
  width: number;
  horizontal: boolean;
} | undefined;
let blockSwipeClick = false;
const pageOffset = ref(0);
const pageDragging = ref(false);
const pageStyle = computed(() => pageOffset.value ? {
  transform: `translate3d(${pageOffset.value}px, 0, 0)`,
  opacity: String(Math.max(0.3, 1 - Math.abs(pageOffset.value) / pageWidth())),
} : undefined);
let daySwipe: { x: number; y: number; time: number; horizontal: boolean } | undefined;
let pageSwitchTimer: number | undefined;
watch(selectedDate, (next, previous) => {
  slideInDay(next > previous ? 1 : -1);
}, { flush: "sync" });
const showScrollTop = ref(false);
const settingsPopup = ref(false);
const recyclePopup = ref(false);
const editorPopup = ref(false);
const editingItemId = ref("");
const editorPhotoId = ref("");
let editorRecordDate = "";
const cameraInput = ref<HTMLInputElement>();
const galleryInput = ref<HTMLInputElement>();
const photoReading = ref(false);
const photoRecognizing = ref(false);
const photoBusy = computed(() => photoReading.value || photoRecognizing.value);
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
const frequentFoods = computed(() => {
  if (form.kind !== "food" || !form.meal) return [];
  const recent = items.value
    .filter((item): item is Extract<SprintRecord, { kind: "food" }> =>
      item.kind === "food" && item.meal === form.meal && Boolean(item.name.trim()))
    .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt) || Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    .slice(0, 30);
  const foods = new Map<string, { name: string; count: number }>();
  for (const item of recent) {
    const name = item.name.trim();
    const key = name.replace(/\s+/g, " ").toLowerCase();
    const food = foods.get(key);
    if (food) food.count += 1;
    else foods.set(key, { name, count: 1 });
  }
  return [...foods.values()].sort((a, b) => b.count - a.count).slice(0, 3).map((food) => food.name);
});
const exerciseOptions = ["徒步", "快走", "跑步", "游泳", "羽毛球", "椭圆机", "跳绳", "体操"];
const editingExerciseName = ref("");
const visibleExerciseOptions = computed(() =>
  editingExerciseName.value && !exerciseOptions.includes(editingExerciseName.value)
    ? [...exerciseOptions, editingExerciseName.value]
    : exerciseOptions);
const canSave = computed(() => {
  const filled = (value: number | string) => value !== "" && Number(value) > 0;
  switch (form.kind) {
    case "food":
      return Boolean(form.meal) && Boolean(form.name.trim() || form.photo || editorPhotoId.value);
    case "weight":
      return filled(form.amount);
    case "exercise":
      return (form.amount === "" || (filled(form.amount) && Number.isSafeInteger(Number(form.amount)))) &&
        (form.distanceKm === "" || filled(form.distanceKm)) &&
        (form.calories === "" || filled(form.calories)) &&
        (form.amount !== "" || form.distanceKm !== "" || form.calories !== "");
    default:
      return false;
  }
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
const thumbnails = reactive(new Map<string, string>());
watch(dayRecords, async (records, _previous, onCleanup) => {
  let canceled = false;
  onCleanup(() => {
    canceled = true;
    for (const url of thumbnails.values()) URL.revokeObjectURL(url);
    thumbnails.clear();
  });
  const revision = storedRevision;
  if (revision === undefined) return;
  for (const { photoId } of records) {
    if (canceled) break;
    if (!photoId) continue;
    const thumbnail = await readThumbnail(photoId, revision).catch(() => undefined);
    if (!canceled && thumbnail) thumbnails.set(photoId, URL.createObjectURL(thumbnail));
  }
});
const isToday = computed(() => selectedDate.value === todayDate.value);
const analysisDateLabel = computed(() =>
  isToday.value ? "截至今天" : `截至${dayjs(selectedDate.value).format("M月D日")}`,
);
const selectedDateLabel = computed(() => {
  const date = dayjs(selectedDate.value);
  const weekday = "日一二三四五六"[date.day()];
  const offset = date.diff(dayjs(todayDate.value), "day");
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
  const cutoff = selectedDate.value;
  const weights = items.value
    .filter((item) => item.kind === "weight")
    .filter((item) => item.recordedAt <= cutoff)
    .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt) || Date.parse(a.updatedAt) - Date.parse(b.updatedAt));
  const latest = weights[weights.length - 1];
  const end = dayjs(cutoff);
  const periods = [
    { label: "近一周", start: end.subtract(6, "day").format(DATE_FORMAT) },
    { label: "近一月", start: end.subtract(29, "day").format(DATE_FORMAT) },
    { label: "较最初", start: weights[0]?.recordedAt },
  ];

  return periods.map(({ label, start }) => {
    const first = start && weights.find((item) => item.recordedAt >= start);
    if (!first || !latest || first === latest) return { label, change: null };
    return { label, change: Number((latest.kilograms - first.kilograms).toFixed(2)) };
  });
});

const exerciseAnalysis = computed(() => {
  const date = selectedDate.value;
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

function pageWidth() {
  return Math.max(320, window.innerWidth || 375);
}

function slideInDay(direction: number) {
  window.clearTimeout(pageSwitchTimer);
  pageDragging.value = true;
  pageOffset.value = direction * pageWidth() * 0.35;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    pageDragging.value = false;
    pageOffset.value = 0;
  }));
}

function startDaySwipe(event: TouchEvent) {
  const target = event.target as HTMLElement;
  if (event.touches.length !== 1 || target.closest(".record-swipe, input, textarea")) {
    daySwipe = undefined;
    return;
  }
  const touch = event.touches[0];
  daySwipe = { x: touch.clientX, y: touch.clientY, time: Date.now(), horizontal: false };
}

function moveDaySwipe(event: TouchEvent) {
  const swipe = daySwipe;
  const touch = event.touches[0];
  if (!swipe || !touch) return;
  const dx = touch.clientX - swipe.x;
  const dy = touch.clientY - swipe.y;
  if (!swipe.horizontal) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 10) return;
    if (Math.abs(dx) < Math.abs(dy) * 1.2) {
      daySwipe = undefined;
      return;
    }
    swipe.horizontal = true;
    window.clearTimeout(pageSwitchTimer);
  }
  if (event.cancelable) event.preventDefault();
  pageDragging.value = true;
  pageOffset.value = dx;
}

function finishDaySwipe(event: TouchEvent) {
  const swipe = daySwipe;
  daySwipe = undefined;
  const touch = event.changedTouches[0];
  if (!swipe?.horizontal || !touch) return;
  const dx = touch.clientX - swipe.x;
  const width = pageWidth();
  const quickFlick = Math.abs(dx) > 50 && Date.now() - swipe.time < 300;
  pageDragging.value = false;
  if (Math.abs(dx) < width * 0.25 && !quickFlick) {
    pageOffset.value = 0;
    return;
  }
  pageOffset.value = Math.sign(dx) * width;
  pageSwitchTimer = window.setTimeout(() => {
    const previous = selectedDate.value;
    changeDay(dx < 0 ? 1 : -1);
    if (selectedDate.value === previous) pageOffset.value = 0;
  }, 180);
}

function cancelDaySwipe() {
  if (daySwipe?.horizontal) {
    pageDragging.value = false;
    pageOffset.value = 0;
  }
  daySwipe = undefined;
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
    (record.photo !== undefined && !isPhoto(record.photo)) ||
    (record.photoId !== undefined && (record.photoId !== record.id || record.photo !== undefined))
  ) return false;
  switch (record.kind) {
    case "food":
      return typeof record.name === "string" && Boolean(record.name.trim() || record.photo || record.photoId) &&
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
    let stored = await readStoredRecords();
    if (stored.revision === undefined) {
      const legacy: unknown = stored.snapshot === undefined ? dataStorage.getter() : JSON.parse(stored.snapshot);
      const initial = legacy === undefined ? { items: [], deletedItems: [] } : legacy;
      if (!isSprintData(initial)) throw new Error("Invalid records");

      const revision = await writeStoredRecords(undefined, [...initial.items, ...initial.deletedItems]);
      if (revision !== undefined) {
        storedRevision = revision;
        data.value = {
          items: initial.items.map(withoutInlinePhoto),
          deletedItems: initial.deletedItems.map(withoutInlinePhoto),
        };
        recordsReady.value = true;
        return;
      }
      // Another tab completed migration while this tab was reading the legacy data.
      stored = await readStoredRecords();
    }
    if (stored.revision === undefined) throw new Error("Records migration incomplete");

    const loaded: SprintData = { items: [], deletedItems: [] };
    for (const item of stored.records) {
      if ("deletedAt" in item) loaded.deletedItems.push(item);
      else loaded.items.push(item);
    }
    if (!isSprintData(loaded)) throw new Error("Invalid records");
    loaded.items.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
    loaded.deletedItems.sort((a, b) => Date.parse(b.deletedAt) - Date.parse(a.deletedAt));

    storedRevision = stored.revision;
    data.value = loaded;
    recordsReady.value = true;
  } catch (error) {
    recordLoadError.value = error instanceof RecordsUpgradeBlockedError ? error.message : "读取本地记录失败，请刷新后重试";
  }
}

async function persist(next: SprintData) {
  if (!recordsReady.value || storedRevision === undefined || saving.value) return false;
  saving.value = true;
  try {
    const previous = new Map([...items.value, ...data.value.deletedItems].map((item) => [item.id, item]));
    const changed: SprintRecord[] = [];
    for (const item of [...next.items, ...next.deletedItems]) {
      if (previous.get(item.id) !== item) changed.push(item);
      previous.delete(item.id);
    }
    const removedIds = [...previous.keys()];
    const revision = await writeStoredRecords(storedRevision, changed, removedIds);
    if (revision === undefined) {
      showToast("其他页面已更新记录，请刷新后重试");
      return false;
    }
    storedRevision = revision;
    data.value = {
      items: next.items.map(withoutInlinePhoto),
      deletedItems: next.deletedItems.map(withoutInlinePhoto),
    };
    return true;
  } catch (error) {
    showToast(error instanceof DOMException && error.name === "QuotaExceededError"
      ? "站点存储空间不足，本次改动未保存。请先备份已保存的记录"
      : "保存失败，请检查浏览器存储空间");
    return false;
  } finally {
    saving.value = false;
  }
}

async function setTheme(theme: ThemeKey) {
  if (savingTheme) return;
  savingTheme = true;
  try {
    await storeTheme(theme);
    currentTheme.value = theme;
  } catch (error) {
    showToast(error instanceof DOMException && error.name === "QuotaExceededError"
      ? "站点存储空间不足，主题未保存"
      : "主题保存失败");
  } finally {
    savingTheme = false;
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
  form.name = item && item.kind !== "weight" ? item.name : (!item && kind === "exercise" ? "椭圆机" : "");
  editingExerciseName.value = item?.kind === "exercise" ? item.name : "";
  form.amount = item?.kind === "weight" ? item.kilograms
    : item?.kind === "exercise" ? item.minutes ?? ""
    : !item && kind === "weight" ? lastWeight(selectedDate.value) ?? ""
    : "";
  form.meal = item?.kind === "food" ? item.meal ?? mealByTime() : (item ? "" : mealByTime());
  form.distanceKm = item?.kind === "exercise" ? item.distanceKm ?? "" : "";
  form.calories = item?.kind === "exercise" ? item.calories ?? "" : "";
  form.photo = "";
  editorPhotoId.value = item?.photoId ?? "";
  editorRecordDate = item?.recordedAt ?? selectedDate.value;
  editorPopup.value = true;
}

function selectExercise(option: string) {
  form.name = form.name === option ? "" : option;
}

function lastWeight(date: string) {
  const weights = items.value
    .filter((record) => record.kind === "weight")
    .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt) || Date.parse(a.updatedAt) - Date.parse(b.updatedAt));
  const before = weights.filter((record) => record.recordedAt <= date);
  return (before[before.length - 1] ?? weights[weights.length - 1])?.kilograms;
}

function stepWeight(delta: number) {
  const current = Number(form.amount);
  const base = form.amount === "" || !Number.isFinite(current) ? lastWeight(selectedDate.value) ?? 60 : current;
  form.amount = Math.max(0.1, Number((base + delta).toFixed(2)));
}

function mealByTime(): Meal {
  const hour = dayjs().hour();
  if (hour >= 5 && hour < 10) return "breakfast";
  if (hour >= 10 && hour < 14) return "lunch";
  if (hour >= 17 && hour < 21) return "dinner";
  return "snack";
}

function resetPhotoAttempt() {
  photoAttempt += 1;
  photoRecognition?.abort();
  photoRecognition = undefined;
  photoReading.value = false;
  photoRecognizing.value = false;
  photoStatus.value = "";
}

function takePhoto(kind?: RecordKind) {
  cameraKind = kind;
  cameraInput.value?.click();
}

function removePhoto() {
  resetPhotoAttempt();
  form.photo = "";
  editorPhotoId.value = "";
}

function closePhotoPreview() {
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = undefined;
  previewing = false;
}

async function previewPhoto(draft: string, id?: string) {
  if (previewing) return;
  previewing = true;
  try {
    const photo = draft ? undefined : id && await readPhoto(id);
    if (unmounted) return;
    if (!draft && !photo) throw new Error("Missing photo");
    previewUrl = photo ? URL.createObjectURL(photo) : undefined;
    showImagePreview({
      images: [previewUrl ?? draft],
      showIndex: false,
      closeable: true,
      teleport: "body",
      onClose: closePhotoPreview,
    });
  } catch {
    closePhotoPreview();
    if (!unmounted) showToast("无法读取照片");
  }
}

async function onPhotoSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file || saving.value) return;
  if (input === cameraInput.value && cameraKind) openEditor(cameraKind);
  if (!editorPopup.value) return;

  const attempt = ++photoAttempt;
  const original = currentPhotoMetrics();
  photoReading.value = true;
  photoStatus.value = "正在读取照片…";
  try {
    const photo = await prepareRecordPhoto(file);
    if (attempt !== photoAttempt) return;
    form.photo = photo;
    editorPhotoId.value = "";
    photoStatus.value = "";
  } catch {
    if (attempt === photoAttempt) photoStatus.value = "无法读取这张照片，请重新拍照或选择图片。";
    return;
  } finally {
    if (attempt === photoAttempt) photoReading.value = false;
  }
  void runPhotoRecognition(original);
}

function currentPhotoMetrics() {
  return { amount: form.amount, distanceKm: form.distanceKm, calories: form.calories };
}

async function runPhotoRecognition(original = currentPhotoMetrics()) {
  const { photo, kind } = form;
  const photoId = editorPhotoId.value;
  if (!editorPopup.value || (!photo && !photoId) || kind === "food" || photoBusy.value || saving.value) return;

  const attempt = ++photoAttempt;
  const controller = new AbortController();
  photoRecognition = controller;
  photoRecognizing.value = true;
  photoStatus.value = "正在识别照片…";
  try {
    let source = photo;
    if (!source) {
      const stored = await readPhoto(photoId);
      if (attempt !== photoAttempt) return;
      if (!stored) throw new Error("Missing photo");
      source = await photoBlobToData(stored);
    }
    if (attempt !== photoAttempt) return;
    const result = await recognizeRecordPhoto(source, kind, controller.signal);
    if (attempt !== photoAttempt) return;
    let filled = false;
    for (const field of ["amount", "distanceKm", "calories"] as const) {
      const value = result[field];
      if (value !== undefined && form[field] === original[field]) {
        form[field] = value;
        filled = true;
      }
    }
    photoStatus.value = filled ? "已填入识别结果，保存前请核对。" : "未自动填入数据，可重新识别或手动填写。";
  } catch {
    if (attempt === photoAttempt) photoStatus.value = "识别失败，可重新识别或手动填写。";
  } finally {
    if (attempt === photoAttempt) {
      photoRecognition = undefined;
      photoRecognizing.value = false;
    }
  }
}

async function saveItem() {
  if (photoReading.value || saving.value || !canSave.value) return;
  if (photoRecognizing.value) resetPhotoAttempt();
  const amount = Number(form.amount);
  const previous = items.value.find((record) => record.id === editingItemId.value);
  const base = {
    id: editingItemId.value || (window.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`),
    recordedAt: editorRecordDate,
    note: previous?.note ?? "",
    updatedAt: new Date().toISOString(),
    photo: form.photo || undefined,
    photoId: editorPhotoId.value || undefined,
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

function startRecordSwipe(event: PointerEvent, id: string, action: "delete" | "restore") {
  if (!event.isPrimary || event.button !== 0 || saving.value) return;
  blockSwipeClick = false;
  const row = event.currentTarget as HTMLElement;
  activeSwipe = {
    id, action, pointerId: event.pointerId,
    startX: event.clientX, startY: event.clientY,
    width: row.clientWidth, horizontal: false,
  };
}

function moveRecordSwipe(event: PointerEvent) {
  const swipe = activeSwipe;
  if (!swipe || swipe.pointerId !== event.pointerId) return;
  const dx = event.clientX - swipe.startX;
  const dy = event.clientY - swipe.startY;
  if (!swipe.horizontal) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 8) return;
    if (Math.abs(dy) >= Math.abs(dx)) {
      cancelRecordSwipe(event);
      return;
    }
    swipe.horizontal = true;
    blockSwipeClick = true;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }
  if (swipe.action === "delete") {
    swipedRecordId.value = swipe.id;
    swipeOffset.value = Math.max(-swipe.width, Math.min(0, dx));
    swipeReady.value = dx <= -swipe.width / 2;
  }
}

function finishRecordSwipe(event: PointerEvent) {
  const swipe = activeSwipe;
  if (!swipe || swipe.pointerId !== event.pointerId) return;
  const dx = event.clientX - swipe.startX;
  cancelRecordSwipe(event);
  if (!swipe.horizontal || saving.value) return;
  if (swipe.action === "delete" && dx <= -swipe.width / 2) void removeItem(swipe.id, true);
  if (swipe.action === "restore" && dx >= 32) void restoreDeletedItem(swipe.id);
}

function cancelRecordSwipe(event: PointerEvent) {
  if (activeSwipe?.pointerId !== event.pointerId) return;
  activeSwipe = undefined;
  swipedRecordId.value = "";
  swipeOffset.value = 0;
  swipeReady.value = false;
}

function suppressSwipeClick(event: MouseEvent) {
  if (!blockSwipeClick || event.detail === 0) return;
  blockSwipeClick = false;
  event.preventDefault();
  event.stopPropagation();
}

async function removeItem(id: string, fromSwipe = false) {
  if (saving.value) return;
  const record = items.value.find((item) => item.id === id);
  if (!record || (!fromSwipe && !await confirmAction("移入回收站", `确认移除「${recordTitle(record)}」吗？`))) return;
  const target = items.value.find((item) => item.id === id);
  if (!target) return;
  const deletedItem = { ...target, deletedAt: new Date().toISOString() };
  if (!await persist({
    items: items.value.filter((item) => item.id !== id),
    deletedItems: [deletedItem, ...deletedItems.value.filter((item) => item.id !== id)],
  })) return;
  if (fromSwipe) {
    lastSwipeDeletedId.value = id;
  } else {
    editorPopup.value = false;
    showToast("已移入回收站");
  }
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
  if (lastSwipeDeletedId.value === id) lastSwipeDeletedId.value = "";
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

async function exportAllData() {
  const revision = storedRevision;
  if (revision === undefined || exporting) return;
  exporting = true;
  try {
    const active = items.value;
    const deleted = data.value.deletedItems.filter(isInRecycleWindow);
    const photoIds = new Set([...active, ...deleted].flatMap((item) => item.photoId ? [item.photoId] : []));
    const photos = await readBackupPhotos([...photoIds], revision);
    const parts = ['{"project":', JSON.stringify(PROJECT), ',"items":['];
    async function appendRecords(records: SprintRecord[]) {
      for (const [index, { photoId, ...record }] of records.entries()) {
        const attachment = photoId ? photos.get(photoId) : undefined;
        if (attachment) record.photo = await photoBlobToData(attachment);
        parts.push(index ? "," : "", JSON.stringify(record));
      }
    }
    await appendRecords(active);
    parts.push('],"deletedItems":[');
    await appendRecords(deleted);
    parts.push("]}");
    if (unmounted) return;
    const blob = new Blob(parts, { type: "application/json;charset=utf-8" });
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
  } catch {
    if (!unmounted) showToast("导出失败，请刷新后重试");
  } finally {
    exporting = false;
  }
}

function onImportFileLoaded(payload: { dataStr: string; fileName: string }) {
  importInfo.value = payload;
  showToast("备份文件已读取");
}

async function importData() {
  try {
    const backup: unknown = JSON.parse(importInfo.value.dataStr);
    if (!isSprintData(backup) || !("project" in backup) || backup.project !== PROJECT ||
      [...backup.items, ...backup.deletedItems].some((item) => item.photoId !== undefined)) {
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

let todayDateTimer: number | undefined;

onMounted(() => {
  void storeTheme().then((storedTheme) => {
    if (isThemeKey(storedTheme)) currentTheme.value = storedTheme;
  }).catch(() => {
    showToast("读取主题失败");
  }).finally(loadRecords);
  updateScrollTopVisibility();
  window.addEventListener("scroll", updateScrollTopVisibility, { passive: true });
  todayDateTimer = window.setInterval(() => {
    todayDate.value = today();
  }, 60_000);
});

onUnmounted(() => {
  unmounted = true;
  closePhotoPreview();
  resetPhotoAttempt();
  window.removeEventListener("scroll", updateScrollTopVisibility);
  window.clearInterval(todayDateTimer);
});
</script>

<style lang="scss" scoped>
.home-page {
  overflow-x: clip;
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
  touch-action: pan-y pinch-zoom;
  transition: transform 0.2s ease-out, opacity 0.2s ease-out;
  will-change: transform;
}

.sprint-view.dragging {
  transition: none;
}

@media (prefers-reduced-motion: reduce) {
  .sprint-view {
    transition: opacity 0.12s ease;
  }
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
  position: relative;
  min-width: 0;
  border-radius: 18px;
  background: var(--surface);
  box-shadow: 0 8px 20px rgba(8, 60, 50, 0.14);
}

.summary-main {
  display: grid;
  gap: 10px;
  width: 100%;
  height: 100%;
  padding: clamp(12px, 3.2vw, 16px);
  border: 0;
  border-radius: inherit;
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition: transform 0.15s ease;
}

.summary-main:active {
  transform: scale(0.97);
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

.summary-card strong {
  display: flex;
  align-items: baseline;
  gap: 3px;
  max-width: 100%;
  min-height: 32px;
  margin-top: 2px;
  color: var(--text-strong);
  overflow-wrap: anywhere;
  font-size: clamp(22px, 5.4vw, 30px);
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

.summary-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  padding-top: 10px;
  border-top: 1px dashed var(--divider);
  white-space: nowrap;
}

.summary-label {
  color: var(--text-subtle);
  font-size: 13px;
  font-weight: 600;
}

.summary-hint {
  display: inline-flex;
  align-items: center;
  font-size: 12px;
  font-weight: 600;
  opacity: 0.85;
}

.summary-hint .el-icon {
  font-size: 11px;
}

.summary-hint.food { color: #b0662a; }
.summary-hint.weight { color: #3a6ea8; }
.summary-hint.exercise { color: #2f7d52; }

.camera-action {
  position: absolute;
  top: clamp(12px, 3.2vw, 16px);
  right: clamp(12px, 3.2vw, 16px);
  display: inline-grid;
  place-items: center;
  width: 34px;
  height: 34px;
  padding: 0;
  border: 1px solid var(--divider);
  border-radius: 50%;
  background: var(--surface);
  color: var(--text-subtle);
  font-size: 16px;
  transition: transform 0.15s ease, color 0.15s ease;
}

.camera-action:active {
  transform: scale(0.9);
}

.camera-action.food { color: #8c4e17; }
.camera-action.weight { color: #26588e; }
.camera-action.exercise { color: #256846; }

.log-panel, .analysis-panel {
  margin-top: 14px;
  padding: clamp(16px, 4vw, 22px);
  border-radius: 20px;
  background: var(--surface);
  box-shadow: var(--header-shadow);
}

.analysis-section {
  margin-top: 14px;
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
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--surface);
  transition: transform 0.18s ease-out;
}

.record-entry.swiping {
  transition: none;
}

.record-swipe {
  position: relative;
  overflow: hidden;
  border-top: 1px solid var(--divider);
  touch-action: pan-y pinch-zoom;
  user-select: none;
}

.swipe-delete {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 0 18px;
  background: var(--swipe-delete-bg);
  color: #fff;
  font-size: 15px;
  font-weight: 700;
}

.swipe-undo {
  display: block;
  width: 100%;
  min-height: 44px;
  padding: 8px;
  border: 0;
  background: var(--surface-soft);
  color: var(--accent);
  font-size: 13px;
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

.record-row.has-photo {
  padding-left: 0;
}

.record-thumbnail {
  margin-left: 4px;
}

.record-thumbnail img {
  display: block;
  width: 34px;
  height: 34px;
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

.meal-field {
  display: grid;
  gap: 6px;
}

.meal-field-label {
  font-size: 14px;
  font-weight: 600;
}

.meal-options {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.meal-options button {
  min-height: 42px;
  padding: 8px 4px;
  border: 1px solid var(--divider);
  border-radius: 10px;
  background: var(--field-bg);
  color: var(--text-main);
  font-size: 15px;
}

.meal-options button.active {
  border-color: transparent;
  background: var(--submit-btn-bg);
  color: #fff;
  font-weight: 700;
}

.weight-stepper {
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr) 48px;
  gap: 8px;
}

.weight-stepper input {
  text-align: center;
  font-size: 18px;
  font-weight: 600;
}

.weight-stepper button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 42px;
  border: 1px solid var(--divider);
  border-radius: 10px;
  background: var(--field-bg);
  color: var(--accent);
  font-size: 18px;
}

.photo-field {
  display: grid;
  gap: 8px;
}

.food-suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.food-suggestions button {
  max-width: 100%;
  min-height: 36px;
  padding: 5px 10px;
  overflow: hidden;
  border: 1px solid var(--divider);
  border-radius: 999px;
  background: var(--field-bg);
  color: var(--accent);
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
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
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.exercise-fields label {
  font-size: 13px;
  white-space: nowrap;
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

.save-button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

@media (hover: hover) {
  .summary-main:hover .summary-hint {
    opacity: 1;
  }

  .record-entry:hover, .record-row:hover {
    background: var(--surface-soft);
  }
}

@media (max-width: 360px) {
  .recycle-item {
    flex-wrap: wrap;
  }
}
</style>
