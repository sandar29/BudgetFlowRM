/* =========================================================
   BUDGETFLOW 2.0
   PERSONAL FINANCIAL MONITORING
   ========================================================= */

"use strict";

/* =========================================================
   1. CONFIGURATION
   ========================================================= */

const STORAGE_KEY = "budgetflow_transactions_v2";
const SETTINGS_KEY = "budgetflow_settings_v2";

/*
 * Region = paket mata uang + format angka.
 * Untuk menambah negara baru, cukup tambahkan satu entri di sini
 * (dan satu <option> di #settingsRegion pada index.html).
 *
 * decimals : jumlah angka di belakang koma yang dipakai mata uang.
 * compact  : singkatan untuk angka besar (miliar, juta, ribu).
 */
const DEFAULT_REGION = "ID";

const REGIONS = {
    ID: {
        code: "ID",
        currency: "IDR",
        symbol: "Rp",
        numberLocale: "id-ID",
        decimals: 0,
        compact: [
            { value: 1e9, suffix: " M" },
            { value: 1e6, suffix: " jt" },
            { value: 1e3, suffix: " rb" }
        ]
    },
    MY: {
        code: "MY",
        currency: "MYR",
        symbol: "RM",
        numberLocale: "en-MY",
        decimals: 2,
        compact: [
            { value: 1e9, suffix: "B" },
            { value: 1e6, suffix: "M" },
            { value: 1e3, suffix: "K" }
        ]
    }
};

function getRegion() {

    return (
        REGIONS[state.settings.region] ||
        REGIONS[DEFAULT_REGION]
    );

}

/* Pembulatan uang ke satuan terkecil (sen) agar jumlah tidak "melayang". */
function roundMoney(value) {

    return Math.round(
        (Number(value) + Number.EPSILON) * 100
    ) / 100;

}

const CATEGORY_META = {
    food: {
        name: "Makanan",
        icon: "utensils"
    },

    transport: {
        name: "Transportasi",
        icon: "car-front"
    },

    shopping: {
        name: "Belanja",
        icon: "shopping-bag"
    },

    bills: {
        name: "Tagihan",
        icon: "receipt"
    },

    health: {
        name: "Kesehatan",
        icon: "heart-pulse"
    },

    entertainment: {
        name: "Hiburan",
        icon: "gamepad-2"
    },

    education: {
        name: "Pendidikan",
        icon: "book-open"
    },

    investment: {
        name: "Investasi",
        icon: "trending-up"
    },

    other: {
        name: "Lainnya",
        icon: "circle-dot"
    }
};

const INCOME_META = {
    salary: { name: "Gaji", icon: "briefcase" },
    bonus: { name: "Bonus", icon: "gift" },
    business: { name: "Usaha", icon: "store" },
    returns: { name: "Hasil investasi", icon: "trending-up" },
    other: { name: "Lainnya", icon: "circle-dot" }
};

function getMeta(category) {
    return INCOME_META[category] ||
        CATEGORY_META[category] ||
        CATEGORY_META.other;
}

function fillCategoryOptions(type) {

    const select = $("#transactionCategory");

    if (!select) return;

    const source =
        type === "income"
            ? INCOME_META
            : CATEGORY_META;

    select.innerHTML =
        Object.entries(source)
            .map(([key, meta]) =>
                `<option value="${key}">${escapeHTML(meta.name)}</option>`
            )
            .join("");

    select.value =
        type === "income" ? "salary" : "food";

}

function calculateInvested(transactions) {

    return transactions
        .filter(t =>
            t.type === "expense" &&
            t.category === "investment"
        )
        .reduce((sum, t) => sum + Number(t.amount), 0);

}

function sortSpendingTotals(totals) {

    return sortCategoryTotals(totals)
        .filter(([category]) => category !== "investment");

}

/* =========================================================
   2. APPLICATION STATE
   ========================================================= */

const state = {
    transactions: [],
    settings: {
        balanceVisible: true,
        userName: "Almira",
        region: DEFAULT_REGION,
        language: "id"
    },

    currentPage: "home",
    transactionType: "expense",
    transactionFilter: "all",
    analysisPeriod: "month",
    searchQuery: "",
    editingId: null
};

/* =========================================================
   3. DOM HELPER
   ========================================================= */

const $ = (selector, parent = document) =>
    parent.querySelector(selector);

const $$ = (selector, parent = document) =>
    [...parent.querySelectorAll(selector)];

/* =========================================================
   4. INITIALIZATION
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    loadData();

    initializeDate();

    initializeNavigation();

    initializeTransactionSheet();

    initializeTransactionFilters();

    initializeAnalysis();

    initializeBalanceToggle();

    initializeNotifications();

    initializeSearch();

    initializeDeleteHandler();

    initializeSheets();

    initializeSettings();

    initializeZakat();

    initializePWA();

    applyRegionToUI();

    renderApplication();

    refreshIcons();

});

/* =========================================================
   5. STORAGE
   ========================================================= */

function loadData() {

    try {

        const savedTransactions =
            localStorage.getItem(STORAGE_KEY);

        const savedSettings =
            localStorage.getItem(SETTINGS_KEY);

        if (savedTransactions) {

            const parsed =
                JSON.parse(savedTransactions);

            if (Array.isArray(parsed)) {
                state.transactions = parsed;
            }

        }

        if (savedSettings) {

            const parsed =
                JSON.parse(savedSettings);

            if (parsed && typeof parsed === "object") {
                state.settings = {
                    ...state.settings,
                    ...parsed
                };
            }

        }

        if (!REGIONS[state.settings.region]) {
            state.settings.region = DEFAULT_REGION;
        }

        /*
         * First-time experience:
         * create a small amount of realistic demo data.
         */
        if (!savedTransactions) {

            state.transactions = createDemoTransactions();

            saveTransactions();

        }

    } catch (error) {

        console.error(
            "BudgetFlow: gagal membaca data.",
            error
        );

        state.transactions = [];

    }

}

function saveTransactions() {

    try {

        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(state.transactions)
        );

    } catch (error) {

        console.error(
            "BudgetFlow: gagal menyimpan transaksi.",
            error
        );

        showToast(
            "Data tidak dapat disimpan di perangkat ini.",
            "error"
        );

    }

}

function saveSettings() {

    try {

        localStorage.setItem(
            SETTINGS_KEY,
            JSON.stringify({
                ...state.settings,
                currency: getRegion().currency
            })
        );

    } catch (error) {

        console.error(
            "BudgetFlow: gagal menyimpan pengaturan.",
            error
        );

    }

}

/* =========================================================
   6. DEMO DATA
   ========================================================= */

function createDemoTransactions() {
    return [];
}

/* =========================================================
   7. NAVIGATION
   ========================================================= */

function initializeNavigation() {

    $$("[data-page]:not(.page)").forEach(button => {

        button.addEventListener("click", () => {

            const page =
                button.dataset.page;

            if (!page) return;

            navigateTo(page);

        });

    });

    $("#navAddButton")
        ?.addEventListener(
            "click",
            openTransactionSheet
        );

}

function navigateTo(page) {

    const validPages = [
        "home",
        "transactions",
        "analysis",
        "islamic"
    ];

    if (!validPages.includes(page)) {
        return;
    }

    state.currentPage = page;

    $$(".page").forEach(section => {

        section.classList.toggle(
            "active",
            section.dataset.page === page
        );

    });

    $$(".nav-item").forEach(item => {

        const isActive =
            item.dataset.page === page;

        item.classList.toggle("active", isActive);

        if (isActive) {
            item.setAttribute("aria-current", "page");
        } else {
            item.removeAttribute("aria-current");
        }

    });

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });

    refreshIcons();

}

/* =========================================================
   8. DATE
   ========================================================= */

function initializeDate() {

    const element =
        $("#currentDate");

    if (!element) return;

    element.textContent =
        formatDateDisplay(
            new Date()
        );

}

function getDateLocale() {

    if (state.settings.language === "en") {
        return getRegion().code === "MY" ? "en-MY" : "en-GB";
    }

    return "id-ID";

}

function formatDateDisplay(date) {

    return new Intl.DateTimeFormat(
        getDateLocale(),
        {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }
    ).format(date);

}

function formatDateLong(date) {

    return new Intl.DateTimeFormat(
        getDateLocale(),
        {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric"
        }
    ).format(date);

}

function formatDateForInput(date) {

    const year =
        date.getFullYear();

    const month =
        String(
            date.getMonth() + 1
        ).padStart(2, "0");

    const day =
        String(
            date.getDate()
        ).padStart(2, "0");

    return `${year}-${month}-${day}`;

}

function parseLocalDate(dateString) {

    const [year, month, day] =
        dateString.split("-").map(Number);

    return new Date(
        year,
        month - 1,
        day
    );

}

/* =========================================================
   9. CURRENCY
   ========================================================= */

function formatCurrency(value, region = getRegion()) {

    const number =
        Number(value) || 0;

    return new Intl.NumberFormat(
        region.numberLocale,
        {
            style: "currency",
            currency: region.currency,
            minimumFractionDigits: region.decimals,
            maximumFractionDigits: region.decimals
        }
    ).format(number)
        .replace(/\s/g, " ");

}

const separatorCache = {};

function getSeparators(region = getRegion()) {

    if (!separatorCache[region.code]) {

        const parts =
            new Intl.NumberFormat(region.numberLocale)
                .formatToParts(1000.1);

        separatorCache[region.code] = {
            group:
                parts.find(p => p.type === "group")?.value || ",",
            decimal:
                parts.find(p => p.type === "decimal")?.value || "."
        };

    }

    return separatorCache[region.code];

}

function formatCompactCurrency(value, region = getRegion()) {

    const number =
        Math.abs(Number(value) || 0);

    const { decimal } =
        getSeparators(region);

    for (const unit of region.compact) {

        if (number >= unit.value) {

            const digits =
                unit.value >= 1e6 ? 1 : 0;

            const text =
                (number / unit.value)
                    .toFixed(digits)
                    .replace(/\.0$/, "")
                    .replace(".", decimal);

            return `${region.symbol} ${text}${unit.suffix}`;

        }

    }

    return formatCurrency(number, region);

}

function parseAmount(value, region = getRegion()) {

    const text =
        String(value ?? "");

    if (region.decimals === 0) {

        return Number(
            text.replace(/[^\d]/g, "")
        ) || 0;

    }

    const { decimal } =
        getSeparators(region);

    const index =
        text.indexOf(decimal);

    const integerPart =
        (index === -1 ? text : text.slice(0, index))
            .replace(/[^\d]/g, "");

    const fractionPart =
        index === -1
            ? ""
            : text.slice(index + 1)
                .replace(/[^\d]/g, "")
                .slice(0, region.decimals);

    return Number(
        `${integerPart || "0"}.${fractionPart || "0"}`
    ) || 0;

}

/* Angka -> teks untuk kolom input (dipakai saat mengedit transaksi). */
function formatAmountValue(value, region = getRegion()) {

    return new Intl.NumberFormat(
        region.numberLocale,
        {
            minimumFractionDigits: 0,
            maximumFractionDigits: region.decimals
        }
    ).format(Number(value) || 0);

}

function formatAmountInput(input, region = getRegion()) {

    const text =
        input.value;

    if (region.decimals === 0) {

        const raw =
            text.replace(/[^\d]/g, "");

        input.value =
            raw
                ? new Intl.NumberFormat(region.numberLocale)
                    .format(Number(raw))
                : "";

        return;

    }

    const { decimal } =
        getSeparators(region);

    const index =
        text.indexOf(decimal);

    const integerDigits =
        (index === -1 ? text : text.slice(0, index))
            .replace(/[^\d]/g, "")
            .replace(/^0+(?=\d)/, "");

    const fractionDigits =
        index === -1
            ? null
            : text.slice(index + 1)
                .replace(/[^\d]/g, "")
                .slice(0, region.decimals);

    if (!integerDigits && fractionDigits === null) {

        input.value = "";

        return;

    }

    const integerText =
        new Intl.NumberFormat(
            region.numberLocale,
            { maximumFractionDigits: 0 }
        ).format(Number(integerDigits || 0));

    input.value =
        fractionDigits === null
            ? integerText
            : `${integerText}${decimal}${fractionDigits}`;

}

/* =========================================================
   10. TRANSACTION SHEET
   ========================================================= */

function initializeTransactionSheet() {

    const sheet =
        $("#transactionSheet");

    if (!sheet) return;

    $("#closeTransactionSheet")
        ?.addEventListener(
            "click",
            closeTransactionSheet
        );

    sheet.addEventListener(
        "click",
        event => {

            if (event.target === sheet) {
                closeTransactionSheet();
            }

        }
    );

    $$(".type-option").forEach(button => {

        button.addEventListener(
            "click",
            () => {

                setTransactionType(
                    button.dataset.type
                );

            }
        );

    });

    const amountInput =
        $("#transactionAmount");

    amountInput?.addEventListener(
        "input",
        () => {

            formatAmountInput(
                amountInput
            );

        }
    );

    $("#transactionDate").value =
        formatDateForInput(
            new Date()
        );

    $("#saveTransaction")
        ?.addEventListener(
            "click",
            handleSaveTransaction
        );

    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Escape" &&
                sheet.classList.contains("active")
            ) {

                closeTransactionSheet();

            }

        }
    );

}

function openTransactionSheet() {

    resetTransactionForm();

    openOverlay("transactionSheet", "#transactionAmount");

}

function closeTransactionSheet() {

    closeOverlay("transactionSheet");

}

function setSheetMode(editing) {

    const eyebrow = $("#sheetEyebrow");
    const title = $("#sheetTitle");
    const save = $("#saveTransaction");

    if (eyebrow) eyebrow.textContent = editing ? "EDIT TRANSACTION" : "NEW TRANSACTION";
    if (title) title.textContent = editing ? "Ubah transaksi" : "Catat transaksi";
    if (save) save.textContent = editing ? "Simpan perubahan" : "Simpan transaksi";

}

function openEditSheet(id) {

    const transaction =
        state.transactions.find(item => item.id === id);

    if (!transaction) return;

    resetTransactionForm();

    state.editingId = id;

    setSheetMode(true);

    setTransactionType(transaction.type);

    const category = $("#transactionCategory");

    if (category) {

        const exists =
            [...category.options].some(o => o.value === transaction.category);

        category.value =
            exists ? transaction.category : "other";

    }

    $("#transactionAmount").value =
        formatAmountValue(transaction.amount);

    $("#transactionNote").value = transaction.note || "";

    $("#transactionDate").value = transaction.date;

    openOverlay("transactionSheet", "#transactionAmount");

}

function resetTransactionForm() {

    state.editingId = null;

    setSheetMode(false);

    state.transactionType =
        "expense";

    $$(".type-option").forEach(button => {

        button.classList.toggle(
            "active",
            button.dataset.type === "expense"
        );

    });

    const amount =
        $("#transactionAmount");

    const note =
        $("#transactionNote");

    const category =
        $("#transactionCategory");

    const date =
        $("#transactionDate");

    if (amount) amount.value = "";

    if (note) note.value = "";

    fillCategoryOptions("expense");

    if (date) {
        date.value =
            formatDateForInput(
                new Date()
            );
    }

}

function setTransactionType(type) {

    if (
        type !== "income" &&
        type !== "expense"
    ) {
        return;
    }

    state.transactionType = type;

    $$(".type-option").forEach(button => {

        button.classList.toggle(
            "active",
            button.dataset.type === type
        );

    });

    /*
     * Income does not need expense-only
     * categories. We keep the same category
     * selector but automatically use "other".
     */
    fillCategoryOptions(type);

}

function handleSaveTransaction() {

    const amountInput =
        $("#transactionAmount");

    const categoryInput =
        $("#transactionCategory");

    const noteInput =
        $("#transactionNote");

    const dateInput =
        $("#transactionDate");

    const amount =
        parseAmount(
            amountInput?.value
        );

    const category =
        categoryInput?.value ||
        "other";

    const note =
        noteInput?.value.trim() ||
        getDefaultTransactionNote(
            state.transactionType,
            category
        );

    const date =
        dateInput?.value ||
        formatDateForInput(
            new Date()
        );

    if (amount <= 0) {

        showToast(
            "Nominal belum diisi.",
            "warning"
        );

        amountInput?.focus();

        return;

    }

    const transaction = {

        id: cryptoId(),

        type:
            state.transactionType,

        amount,

        category,

        note,

        date,

        createdAt:
            Date.now()

    };

    const editing =
        state.editingId &&
        state.transactions.find(t => t.id === state.editingId);

    if (editing) {

        Object.assign(editing, {
            type: transaction.type,
            amount,
            category,
            note,
            date
        });

    } else {

        state.transactions.push(
            transaction
        );

    }

    const wasEditing = Boolean(editing);

    saveTransactions();

    closeTransactionSheet();

    renderApplication();

    showToast(
        wasEditing
            ? "Transaksi berhasil diperbarui."
            : state.transactionType === "income"
                ? "Pemasukan berhasil dicatat."
                : "Pengeluaran berhasil dicatat.",
        "success"
    );

}

function getDefaultTransactionNote(
    type,
    category
) {

    if (type === "income") {
        return "Pemasukan";
    }

    return CATEGORY_META[category]?.name ||
        "Pengeluaran";

}

/* =========================================================
   11. RENDER APPLICATION
   ========================================================= */

function renderApplication() {

    renderUser();

    renderBalance();

    renderMonthlySummary();

    renderSpendingSummary();

    renderRecentTransactions();

    renderFullTransactions();

    renderAnalysis();

    renderInsight();

    renderChart();

    renderCategories();

    updateNotificationDot();

    refreshIcons();

}

/* =========================================================
   12. USER
   ========================================================= */

function renderUser() {

    const element =
        $("#userName");

    if (!element) return;

    element.textContent =
        state.settings.userName ||
        "Almira";

}

/* =========================================================
   13. BALANCE
   ========================================================= */

function calculateBalance() {

    return roundMoney(state.transactions.reduce(
        (total, transaction) => {

            if (transaction.type === "income") {

                return total + Number(
                    transaction.amount
                );

            }

            return total - Number(
                transaction.amount
            );

        },
        0
    ));

}

function calculateIncome(transactions) {

    return roundMoney(transactions
        .filter(
            transaction =>
                transaction.type === "income"
        )
        .reduce(
            (sum, transaction) =>
                sum + Number(transaction.amount),
            0
        ));

}

function calculateExpense(transactions) {

    return roundMoney(transactions
        .filter(
            transaction =>
                transaction.type === "expense"
        )
        .reduce(
            (sum, transaction) =>
                sum + Number(transaction.amount),
            0
        ));

}

function getCurrentMonthTransactions() {

    const now =
        new Date();

    return state.transactions.filter(
        transaction => {

            const date =
                parseLocalDate(
                    transaction.date
                );

            return (
                date.getMonth() ===
                    now.getMonth() &&
                date.getFullYear() ===
                    now.getFullYear()
            );

        }
    );

}

function getLastMonthTransactions() {

    const now =
        new Date();

    const month =
        now.getMonth() - 1;

    const year =
        month < 0
            ? now.getFullYear() - 1
            : now.getFullYear();

    const normalizedMonth =
        month < 0
            ? 11
            : month;

    return state.transactions.filter(
        transaction => {

            const date =
                parseLocalDate(
                    transaction.date
                );

            return (
                date.getMonth() ===
                    normalizedMonth &&
                date.getFullYear() ===
                    year
            );

        }
    );

}

function renderBalance() {

    const balanceElement =
        $("#balanceValue");

    if (!balanceElement) return;

    const balance =
        calculateBalance();

    if (
        state.settings.balanceVisible
    ) {

        balanceElement.textContent =
            formatCurrency(balance);

    } else {

        balanceElement.textContent =
            `${getRegion().symbol} •••••••`;

    }

    const toggle =
        $("#toggleBalance");

    if (toggle) {

        toggle.innerHTML =
            state.settings.balanceVisible
                ? `<i data-lucide="eye"></i>`
                : `<i data-lucide="eye-off"></i>`;

    }

}

function renderMonthlySummary() {

    const transactions =
        getCurrentMonthTransactions();

    const income =
        calculateIncome(
            transactions
        );

    const expense =
        calculateExpense(
            transactions
        );

    const incomeElement =
        $("#monthlyIncome");

    const expenseElement =
        $("#monthlyExpense");

    if (incomeElement) {

        incomeElement.textContent =
            formatCompactCurrency(income);

    }

    if (expenseElement) {

        expenseElement.textContent =
            formatCompactCurrency(expense);

    }

}

/* =========================================================
   14. SPENDING
   ========================================================= */

function renderSpendingSummary() {

    const current =
        getCurrentMonthTransactions();

    const currentExpense =
        calculateExpense(current);

    const last =
        getLastMonthTransactions();

    const lastExpense =
        calculateExpense(last);

    const totalElement =
        $("#spendingTotal");

    if (totalElement) {

        totalElement.textContent =
            formatCurrency(currentExpense);

    }

    const changeElement =
        $("#spendingChange");

    if (!changeElement) return;

    if (lastExpense === 0) {

        changeElement.textContent =
            "Bulan ini";

        changeElement.classList.remove(
            "negative"
        );

        return;

    }

    const change =
        (
            (currentExpense - lastExpense) /
            lastExpense
        ) * 100;

    const rounded =
        Math.round(
            Math.abs(change)
        );

    if (change > 0) {

        changeElement.textContent =
            `↑ ${rounded}%`;

        changeElement.classList.add(
            "negative"
        );

    } else if (change < 0) {

        changeElement.textContent =
            `↓ ${rounded}%`;

        changeElement.classList.remove(
            "negative"
        );

    } else {

        changeElement.textContent =
            "Stabil";

        changeElement.classList.remove(
            "negative"
        );

    }

}

/* =========================================================
   15. CATEGORY DATA
   ========================================================= */

function getCategoryTotals(
    transactions
) {

    const totals = {};

    transactions
        .filter(
            transaction =>
                transaction.type === "expense"
        )
        .forEach(
            transaction => {

                const category =
                    transaction.category ||
                    "other";

                totals[category] =
                    (
                        totals[category] || 0
                    ) +
                    Number(
                        transaction.amount
                    );

            }
        );

    return totals;

}

function sortCategoryTotals(
    totals
) {

    return Object.entries(totals)
        .sort(
            (a, b) => b[1] - a[1]
        );

}

function renderCategories() {

    const container =
        $("#spendingCategories");

    if (!container) return;

    const transactions =
        getCurrentMonthTransactions();

    const totals =
        getCategoryTotals(
            transactions
        );

    const sorted =
        sortCategoryTotals(
            totals
        );

    if (!sorted.length) {

        container.innerHTML =
            createEmptyState(
                "wallet-cards",
                "Belum ada pengeluaran",
                "Catat pengeluaran untuk melihat ke mana uangmu pergi."
            );

        return;

    }

    const max =
        sorted[0][1];

    const topCategories =
        sorted.slice(0, 5);

    container.innerHTML =
        topCategories
            .map(
                ([category, amount]) => {

                    const meta =
                        CATEGORY_META[category] ||
                        CATEGORY_META.other;

                    const percentage =
                        max > 0
                            ? (
                                amount / max
                            ) * 100
                            : 0;

                    return `
                        <article class="category-item">

                            <div class="category-top">

                                <div class="category-name">

                                    <div class="category-icon">
                                        <i data-lucide="${meta.icon}"></i>
                                    </div>

                                    <span>
                                        ${escapeHTML(meta.name)}
                                    </span>

                                </div>

                                <strong class="category-value">
                                    ${formatCurrency(amount)}
                                </strong>

                            </div>

                            <div class="category-progress">

                                <div
                                    class="category-progress-value"
                                    style="width: ${Math.min(100, percentage)}%"
                                ></div>

                            </div>

                        </article>
                    `;

                }
            )
            .join("");

}

/* =========================================================
   16. RECENT TRANSACTIONS
   ========================================================= */

function getSortedTransactions(
    transactions = state.transactions
) {

    return [...transactions]
        .sort(
            (a, b) => {

                const dateDifference =
                    parseLocalDate(b.date) -
                    parseLocalDate(a.date);

                if (dateDifference !== 0) {
                    return dateDifference;
                }

                return (
                    Number(b.createdAt || 0) -
                    Number(a.createdAt || 0)
                );

            }
        );

}

function renderRecentTransactions() {

    const container =
        $("#recentTransactions");

    if (!container) return;

    const recent =
        getSortedTransactions()
            .slice(0, 5);

    if (!recent.length) {

        container.innerHTML =
            createEmptyState(
                "receipt",
                "Belum ada transaksi",
                "Mulai dengan mencatat pemasukan atau pengeluaran."
            );

        return;

    }

    container.innerHTML =
        recent
            .map(
                createTransactionHTML
            )
            .join("");

}

function renderFullTransactions() {

    const container =
        $("#fullTransactionList");

    if (!container) return;

    let transactions =
        getSortedTransactions();

    if (
        state.transactionFilter !== "all"
    ) {

        transactions =
            transactions.filter(
                transaction =>
                    transaction.type ===
                    state.transactionFilter
            );

    }

    if (state.searchQuery) {

        transactions =
            transactions.filter(t =>
                [
                    t.note,
                    getMeta(t.category).name,
                    t.type,
                    t.date
                ]
                    .join(" ")
                    .toLowerCase()
                    .includes(state.searchQuery)
            );

    }

    if (!transactions.length) {

        container.innerHTML =
            createEmptyState(
                "search-x",
                "Tidak ada transaksi",
                "Belum ada transaksi yang sesuai dengan filter."
            );

        return;

    }

    const grouped =
        groupTransactionsByDate(
            transactions
        );

    container.innerHTML =
        Object.entries(grouped)
            .map(
                ([date, items]) => {

                    return `
                        <section class="transaction-group">

                            <div class="transaction-group-title">

                                <span>
                                    ${escapeHTML(
                                        formatDateLong(
                                            parseLocalDate(date)
                                        )
                                    )}
                                </span>

                                <span>
                                    ${items.length}
                                </span>

                            </div>

                            <div class="transaction-list">

                                ${items
                                    .map(
                                        createTransactionHTML
                                    )
                                    .join("")}

                            </div>

                        </section>
                    `;

                }
            )
            .join("");

}

function groupTransactionsByDate(
    transactions
) {

    return transactions.reduce(
        (groups, transaction) => {

            const key =
                transaction.date;

            if (!groups[key]) {
                groups[key] = [];
            }

            groups[key].push(
                transaction
            );

            return groups;

        },
        {}
    );

}

function createTransactionHTML(
    transaction
) {

    const meta =
        getMeta(transaction.category);

    const isIncome =
        transaction.type === "income";

    const amountPrefix =
        isIncome ? "+" : "-";

    const safeNote =
        escapeHTML(
            transaction.note ||
            meta.name
        );

    const safeCategory =
        escapeHTML(
            meta.name
        );

    return `
        <article
            class="transaction-item"
            data-transaction-id="${transaction.id}"
        >

            <button
                type="button"
                class="transaction-main"
                data-edit-id="${transaction.id}"
                title="Ubah transaksi"
            >

                <span class="transaction-icon ${isIncome ? "income" : "expense"}">

                    <i data-lucide="${
                        isIncome
                            ? "arrow-down-left"
                            : meta.icon
                    }"></i>

                </span>

                <span class="transaction-info">

                    <span class="transaction-title">
                        ${safeNote}
                    </span>

                    <span class="transaction-meta">
                        ${safeCategory} · ${formatDateDisplay(
                            parseLocalDate(
                                transaction.date
                            )
                        )}
                    </span>

                </span>

                <span class="transaction-amount ${isIncome ? "income" : "expense"}">

                    ${amountPrefix}
                    ${formatCurrency(
                        transaction.amount
                    )}

                </span>

            </button>

            <button
                class="transaction-delete"
                data-delete-id="${transaction.id}"
                aria-label="Hapus transaksi"
            >
                <i data-lucide="trash-2"></i>
            </button>

        </article>
    `;

}

function initializeDeleteHandler() {

    /*
     * Event delegation: one listener handles the delete and
     * edit buttons in every list (home, full list, search).
     */
    document.addEventListener("click", event => {

        const del =
            event.target.closest("[data-delete-id]");

        if (del) {

            event.stopPropagation();

            deleteTransaction(del.dataset.deleteId);

            return;

        }

        const edit =
            event.target.closest("[data-edit-id]");

        if (edit) {
            openEditSheet(edit.dataset.editId);
        }

    });

}

async function deleteTransaction(id) {

    const transaction =
        state.transactions.find(
            item => item.id === id
        );

    if (!transaction) return;

    const confirmed =
        await confirmAction({
            title: "Hapus transaksi?",
            message: `${transaction.note || "Transaksi"} (${formatCurrency(transaction.amount)}) akan dihapus permanen.`,
            confirmText: "Hapus"
        });

    if (!confirmed) return;

    state.transactions =
        state.transactions.filter(
            item => item.id !== id
        );

    saveTransactions();

    renderApplication();

    showToast(
        "Transaksi berhasil dihapus.",
        "success"
    );

}

/* =========================================================
   17. ANALYSIS
   ========================================================= */

function initializeAnalysis() {

    $$(".period-button").forEach(
        button => {

            button.addEventListener(
                "click",
                () => {

                    state.analysisPeriod =
                        button.dataset.period;

                    $$(".period-button")
                        .forEach(
                            item => {

                                item.classList.toggle(
                                    "active",
                                    item === button
                                );

                            }
                        );

                    renderAnalysis();

                }
            );

        }
    );

}

function getAnalysisTransactions() {

    if (
        state.analysisPeriod ===
        "last-month"
    ) {

        return getLastMonthTransactions();

    }

    return getCurrentMonthTransactions();

}

function renderAnalysis() {

    const transactions =
        getAnalysisTransactions();

    const income =
        calculateIncome(
            transactions
        );

    const expense =
        calculateExpense(
            transactions
        );

    const net =
        income - expense;

    const netElement =
        $("#analysisNet");

    const incomeElement =
        $("#analysisIncome");

    const expenseElement =
        $("#analysisExpense");

    if (netElement) {

        netElement.textContent =
            formatCurrency(net);

    }

    if (incomeElement) {

        incomeElement.textContent =
            formatCurrency(income);

    }

    if (expenseElement) {

        expenseElement.textContent =
            formatCurrency(expense);

    }

    renderNetStatus(net);

    renderDonutChart(
        transactions
    );

    renderMonthlyComparison();

    renderSavingRate(income, expense, calculateInvested(transactions));

    renderAnalysisInsight(
        transactions,
        income,
        expense
    );

    refreshIcons();

}

function renderNetStatus(net) {

    const element =
        $("#analysisNetStatus");

    if (!element) return;

    element.classList.remove(
        "positive",
        "negative"
    );

    if (net >= 0) {

        element.textContent =
            "Positif";

        element.classList.add(
            "positive"
        );

    } else {

        element.textContent =
            "Defisit";

        element.classList.add(
            "negative"
        );

    }

}

function renderDonutChart(
    transactions
) {

    const chart =
        $("#donutChart");

    if (!chart) return;

    const totals =
        getCategoryTotals(
            transactions
        );

    const sorted =
        sortCategoryTotals(
            totals
        );

    const total =
        sorted.reduce(
            (sum, [, amount]) =>
                sum + amount,
            0
        );

    const totalElement =
        $("#donutTotal");

    if (totalElement) {

        totalElement.textContent =
            formatCompactCurrency(total);

    }

    if (!total) {

        chart.style.background =
            "conic-gradient(#dce5e2 0deg 360deg)";

        renderLegend([], 0, []);

        return;

    }

    const gradientColors = [
        "var(--primary)",
        "#7ebdb5",
        "#d8b758",
        "#a8c8c3",
        "#c7d8d4",
        "#dce5e2"
    ];

    /*
     * Show the top 5 categories and merge the rest
     * into one segment so the donut always adds up to 100%.
     */
    const display =
        sorted.length > 6
            ? [
                ...sorted.slice(0, 5),
                [
                    "__others",
                    sorted
                        .slice(5)
                        .reduce(
                            (sum, [, amount]) =>
                                sum + amount,
                            0
                        )
                ]
            ]
            : sorted;

    let currentDegree = 0;

    const segments =
        display
            .map(
                ([, amount], index) => {

                    const degree =
                        (
                            amount /
                            total
                        ) * 360;

                    const start =
                        currentDegree;

                    const end =
                        currentDegree +
                        degree;

                    currentDegree =
                        end;

                    return `
                        ${gradientColors[index % gradientColors.length]}
                        ${start}deg ${end}deg
                    `;

                }
            );

    chart.style.background =
        `conic-gradient(${segments.join(",")})`;

    renderLegend(
        display,
        total,
        gradientColors
    );

}

function renderLegend(
    sorted,
    total,
    colors
) {

    const container =
        $("#categoryLegend");

    if (!container) return;

    if (!sorted.length) {

        container.innerHTML =
            `
                <div class="empty-state">
                    <div class="empty-state-icon">
                        <i data-lucide="pie-chart"></i>
                    </div>

                    <h3>Belum ada data</h3>

                    <p>
                        Catat pengeluaran untuk melihat breakdown.
                    </p>
                </div>
            `;

        return;

    }

    container.innerHTML =
        sorted
            .map(
                ([category, amount], index) => {

                    const meta =
                        category === "__others"
                            ? { name: "Kategori lain" }
                            : (
                                CATEGORY_META[category] ||
                                CATEGORY_META.other
                            );

                    const percentage =
                        total > 0
                            ? Math.round(
                                (
                                    amount /
                                    total
                                ) * 100
                            )
                            : 0;

                    return `
                        <div class="legend-item">

                            <div class="legend-name">

                                <span
                                    class="legend-dot"
                                    style="
                                        background:
                                        ${colors[index % colors.length]}
                                    "
                                ></span>

                                <span>
                                    ${escapeHTML(meta.name)}
                                </span>

                            </div>

                            <strong class="legend-value">
                                ${percentage}%
                            </strong>

                        </div>
                    `;

                }
            )
            .join("");

}

function renderMonthlyComparison() {

    const current =
        calculateExpense(
            getCurrentMonthTransactions()
        );

    const last =
        calculateExpense(
            getLastMonthTransactions()
        );

    const currentElement =
        $("#currentMonthExpense");

    const lastElement =
        $("#lastMonthExpense");

    if (currentElement) {

        currentElement.textContent =
            formatCurrency(current);

    }

    if (lastElement) {

        lastElement.textContent =
            formatCurrency(last);

    }

    const text =
        $("#comparisonText");

    if (!text) return;

    if (last === 0 && current === 0) {

        text.textContent =
            "Belum ada pengeluaran untuk dibandingkan.";

        return;

    }

    if (last === 0) {

        text.textContent =
            "Belum ada data pengeluaran dari bulan lalu.";

        return;

    }

    const difference =
        current - last;

    const percentage =
        Math.round(
            Math.abs(
                difference / last * 100
            )
        );

    if (difference > 0) {

        text.textContent =
            `Pengeluaran bulan ini ${percentage}% lebih tinggi dibanding bulan lalu.`;

    } else if (difference < 0) {

        text.textContent =
            `Pengeluaran bulan ini ${percentage}% lebih rendah dibanding bulan lalu.`;

    } else {

        text.textContent =
            "Pengeluaran bulan ini sama dengan bulan lalu.";

    }

}

function renderSavingRate(
    income,
    expense,
    invested = 0
) {

    const rateElement =
        $("#savingRate");

    const progress =
        $("#savingProgress");

    const description =
        $("#savingDescription");

    if (!rateElement) return;

    if (income <= 0) {

        rateElement.textContent =
            "0%";

        if (progress) {
            progress.style.width = "0%";
        }

        if (description) {

            description.textContent =
                "Belum ada pemasukan yang tercatat pada periode ini.";

        }

        return;

    }

    const saved =
        Math.max(
            0,
            income - expense + invested
        );

    const rate =
        Math.round(
            (saved / income) * 100
        );

    const displayRate =
        Math.max(
            0,
            Math.min(
                100,
                rate
            )
        );

    rateElement.textContent =
        `${displayRate}%`;

    if (progress) {

        progress.style.width =
            `${displayRate}%`;

    }

    if (description) {

        if (rate >= 50) {

            description.textContent =
                `Dari pemasukan ${formatCurrency(income)}, sekitar ${formatCurrency(saved)} belum terpakai.`;

        } else if (rate >= 20) {

            description.textContent =
                `Sekitar ${displayRate}% pemasukan belum terpakai pada periode ini.`;

        } else if (rate > 0) {

            description.textContent =
                `Sebagian besar pemasukan sudah terpakai. Sisa saat ini sekitar ${formatCurrency(saved)}.`;

        } else {

            description.textContent =
                "Seluruh pemasukan periode ini sudah terpakai.";

        }

    }

}

function renderAnalysisInsight(
    transactions,
    income,
    expense
) {

    const title =
        $("#analysisInsightTitle");

    const text =
        $("#analysisInsightText");

    if (!title || !text) return;

    if (!transactions.length) {

        title.textContent =
            "Belum ada data";

        text.textContent =
            "Tambahkan transaksi untuk mendapatkan insight.";

        return;

    }

    if (income === 0 && expense > 0) {

        title.textContent =
            "Ada pengeluaran yang tercatat";

        text.textContent =
            `Kamu mencatat ${formatCurrency(expense)} pengeluaran tanpa pemasukan pada periode ini.`;

        return;

    }

    if (income > 0 && expense === 0) {

        title.textContent =
            "Belum ada pengeluaran";

        text.textContent =
            `Kamu memiliki pemasukan ${formatCurrency(income)} dan belum mencatat pengeluaran pada periode ini.`;

        return;

    }

    const totals =
        getCategoryTotals(
            transactions
        );

    const sorted =
        sortSpendingTotals(
            totals
        );

    if (sorted.length) {

        const [category, amount] =
            sorted[0];

        const meta =
            CATEGORY_META[category] ||
            CATEGORY_META.other;

        const percentage =
            expense > 0
                ? Math.round(
                    (
                        amount /
                        expense
                    ) * 100
                )
                : 0;

        title.textContent =
            `${meta.name} menjadi pengeluaran terbesar`;

        text.textContent =
            `${formatCurrency(amount)} atau sekitar ${percentage}% dari total pengeluaran periode ini.`;

        return;

    }

    title.textContent =
        "Cash flow sedang dipantau";

    text.textContent =
        `Pemasukan ${formatCurrency(income)} dan pengeluaran ${formatCurrency(expense)} tercatat pada periode ini.`;

}

/* =========================================================
   18. HOME INSIGHT
   ========================================================= */

function renderInsight() {

    const title =
        $("#financialInsightTitle");

    const text =
        $("#financialInsightText");

    if (!title || !text) return;

    const transactions =
        getCurrentMonthTransactions();

    const income =
        calculateIncome(
            transactions
        );

    const expense =
        calculateExpense(
            transactions
        );

    if (!transactions.length) {

        title.textContent =
            "Mulai dari mencatat transaksi";

        text.textContent =
            "Setelah ada beberapa transaksi, BudgetFlow akan membantu membaca pola keuanganmu.";

        return;

    }

    if (income > 0 && expense > income) {

        title.textContent =
            "Pengeluaran melebihi pemasukan";

        text.textContent =
            `Pengeluaran bulan ini ${formatCurrency(expense)} sementara pemasukan ${formatCurrency(income)}.`;

        return;

    }

    if (income > 0 && expense === 0) {

        title.textContent =
            "Belum ada pengeluaran";

        text.textContent =
            "Pemasukan sudah tercatat, tetapi belum ada pengeluaran pada bulan ini.";

        return;

    }

    if (income > 0) {

        const remaining =
            income - expense;

        const rate =
            Math.round(
                (
                    remaining /
                    income
                ) * 100
            );

        if (rate >= 50) {

            title.textContent =
                "Cash flow terlihat positif";

            text.textContent =
                `${rate}% pemasukan bulan ini belum terpakai berdasarkan transaksi yang kamu catat.`;

        } else {

            const totals =
                getCategoryTotals(
                    transactions
                );

            const sorted =
                sortSpendingTotals(
                    totals
                );

            if (sorted.length) {

                const [category, amount] =
                    sorted[0];

                const meta =
                    CATEGORY_META[category] ||
                    CATEGORY_META.other;

                title.textContent =
                    `${meta.name} paling banyak mengambil porsi`;

                text.textContent =
                    `${formatCurrency(amount)} menjadi pengeluaran terbesar bulan ini.`;

            } else {

                title.textContent =
                    "Keuanganmu sedang dipantau";

                text.textContent =
                    `Saldo bersih bulan ini bertambah ${formatCurrency(remaining)}.`;

            }

        }

        return;

    }

    if (expense > 0) {

        title.textContent =
            "Catat pemasukanmu juga";

        text.textContent =
            `Saat ini terdapat ${formatCurrency(expense)} pengeluaran pada bulan ini.`;

        return;

    }

    title.textContent =
        "Data keuanganmu";

    text.textContent =
        "Terus catat transaksi agar BudgetFlow bisa membaca pola keuanganmu.";

}

/* =========================================================
   19. CHART
   ========================================================= */

function renderChart() {

    const line =
        $("#chartLine");

    const area =
        $("#chartArea");

    if (!line || !area) return;

    const now =
        new Date();

    const daysInMonth =
        new Date(
            now.getFullYear(),
            now.getMonth() + 1,
            0
        ).getDate();

    const currentDay =
        now.getDate();

    const expenses =
        getCurrentMonthTransactions()
            .filter(
                transaction =>
                    transaction.type ===
                    "expense"
            );

    const daily = [];

    for (
        let day = 1;
        day <= daysInMonth;
        day++
    ) {

        const amount =
            expenses
                .filter(
                    transaction => {

                        const date =
                            parseLocalDate(
                                transaction.date
                            );

                        return (
                            date.getDate() === day
                        );

                    }
                )
                .reduce(
                    (sum, transaction) =>
                        sum +
                        Number(
                            transaction.amount
                        ),
                    0
                );

        daily.push(amount);

    }

    /*
     * Only display the part of the month
     * that has already occurred.
     */
    const visible =
        daily.slice(
            0,
            Math.max(
                1,
                currentDay
            )
        );

    const cumulative = [];

    let running = 0;

    visible.forEach(
        value => {

            running += value;

            cumulative.push(
                running
            );

        }
    );

    /*
     * A single data point cannot form a line,
     * so start the line from zero.
     */
    if (cumulative.length === 1) {
        cumulative.unshift(0);
    }

    if (!cumulative.length) {

        line.setAttribute(
            "d",
            ""
        );

        area.setAttribute(
            "d",
            ""
        );

        return;

    }

    const width = 600;
    const height = 220;

    const paddingX = 10;
    const paddingY = 20;

    const maxValue =
        Math.max(
            ...cumulative,
            1
        );

    const points =
        cumulative.map(
            (value, index) => {

                const x =
                    paddingX +
                    (
                        index /
                        Math.max(
                            cumulative.length - 1,
                            1
                        )
                    ) *
                    (
                        width -
                        paddingX * 2
                    );

                const y =
                    height -
                    paddingY -
                    (
                        value /
                        maxValue
                    ) *
                    (
                        height -
                        paddingY * 2
                    );

                return {
                    x,
                    y
                };

            }
        );

    const path =
        points
            .map(
                (point, index) => {

                    return `${
                        index === 0
                            ? "M"
                            : "L"
                    } ${point.x} ${point.y}`;

                }
            )
            .join(" ");

    const areaPath =
        `${path}
         L ${points.at(-1).x} ${height}
         L ${points[0].x} ${height}
         Z`;

    line.setAttribute(
        "d",
        path
    );

    area.setAttribute(
        "d",
        areaPath
    );

}

/* =========================================================
   20. TRANSACTION FILTER
   ========================================================= */

function initializeTransactionFilters() {

    $$(".filter-chip").forEach(
        button => {

            button.addEventListener(
                "click",
                () => {

                    state.transactionFilter =
                        button.dataset.filter ||
                        "all";

                    $$(".filter-chip")
                        .forEach(
                            item => {

                                item.classList.toggle(
                                    "active",
                                    item === button
                                );

                            }
                        );

                    renderFullTransactions();

                    refreshIcons();

                }
            );

        }
    );

}

/* =========================================================
   21. BALANCE TOGGLE
   ========================================================= */

function initializeBalanceToggle() {

    $("#toggleBalance")
        ?.addEventListener(
            "click",
            () => {

                state.settings.balanceVisible =
                    !state.settings.balanceVisible;

                saveSettings();

                renderBalance();

                refreshIcons();

            }
        );

}

/* =========================================================
   22. NOTIFICATION
   ========================================================= */

function getNotifications() {

    const transactions = getCurrentMonthTransactions();
    const income = calculateIncome(transactions);
    const expense = calculateExpense(transactions);
    const now = new Date();
    const list = [];

    if (expense > 0 && expense > income) {

        list.push({
            id: `overspend-${now.getFullYear()}-${now.getMonth() + 1}`,
            message: `Pengeluaran bulan ini (${formatCurrency(expense)}) melebihi pemasukan (${formatCurrency(income)}).`
        });

    }

    return list;

}

function updateNotificationDot() {

    const dot = $("#notificationDot");

    if (!dot) return;

    const seen = state.settings.seenNotifications || [];

    dot.hidden =
        !getNotifications().some(n => !seen.includes(n.id));

}

function initializeNotifications() {

    $("#notificationButton")
        ?.addEventListener(
            "click",
            () => {

                const list = getNotifications();

                if (!list.length) {

                    showToast(
                        "Tidak ada notifikasi baru.",
                        "info"
                    );

                    return;

                }

                list.forEach(n =>
                    showToast(n.message, "warning", "Peringatan")
                );

                state.settings.seenNotifications =
                    list.map(n => n.id);

                saveSettings();

                updateNotificationDot();

            }
        );

}

/* =========================================================
   23. SEARCH
   ========================================================= */

function initializeSearch() {

    const button = $("#transactionSearchButton");
    const bar = $("#searchBar");
    const input = $("#transactionSearchInput");

    if (!button || !bar || !input) return;

    button.setAttribute("aria-expanded", "false");

    button.addEventListener("click", () => {

        const opening = bar.hidden;

        bar.hidden = !opening;

        button.setAttribute("aria-expanded", String(opening));

        if (opening) {

            input.focus();

        } else {

            input.value = "";
            state.searchQuery = "";
            renderFullTransactions();
            refreshIcons();

        }

    });

    input.addEventListener("input", () => {

        state.searchQuery =
            input.value.trim().toLowerCase();

        renderFullTransactions();
        refreshIcons();

    });

}

/* =========================================================
   24. TOAST
   ========================================================= */

function showToast(
    message,
    type = "success",
    title = null
) {
    const toast = $("#toast");
    const toastTitle = $("#toastTitle");
    const toastMessage = $("#toastMessage");
    const toastIcon = toast?.querySelector(".toast-icon");
    const progress = toast?.querySelector(".toast-progress");

    if (!toast) return;

    const titles = {
        success: "Berhasil",
        error: "Terjadi Kesalahan",
        warning: "Perlu Diperhatikan",
        info: "Informasi"
    };

    const icons = {
        success: "check-circle-2",
        error: "circle-alert",
        warning: "triangle-alert",
        info: "info"
    };

    toast.classList.remove(
        "success",
        "error",
        "warning",
        "info",
        "show"
    );

    toast.classList.add(type);

    if (toastTitle) {
        toastTitle.textContent = title || titles[type] || "Informasi";
    }

    if (toastMessage) {
        toastMessage.textContent = message;
    }

    if (toastIcon) {
        toastIcon.innerHTML = `
            <i data-lucide="${icons[type] || icons.info}"></i>
        `;
    }

    /* Reset progress animation */
    if (progress) {
        progress.style.animation = "none";

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                progress.style.animation =
                    "toastProgress 3.8s linear forwards";
            });
        });
    }

    if (window.lucide) {
        lucide.createIcons();
    }

    requestAnimationFrame(() => {
        toast.classList.add("show");
    });

    clearTimeout(window.__budgetFlowToastTimer);

    window.__budgetFlowToastTimer = setTimeout(() => {
        toast.classList.remove("show");
    }, 3800);
}

$("#closeToast")?.addEventListener("click", () => {
    $("#toast")?.classList.remove("show");
});

/* =========================================================
   25. EMPTY STATE
   ========================================================= */

function createEmptyState(
    icon,
    title,
    description
) {

    return `
        <div class="empty-state">

            <div class="empty-state-icon">
                <i data-lucide="${icon}"></i>
            </div>

            <h3>
                ${escapeHTML(title)}
            </h3>

            <p>
                ${escapeHTML(description)}
            </p>

        </div>
    `;

}

/* =========================================================
   26. UTILITY
   ========================================================= */

function cryptoId() {

    if (
        window.crypto &&
        typeof window.crypto.randomUUID ===
            "function"
    ) {

        return window.crypto.randomUUID();

    }

    return (
        Date.now().toString(36) +
        Math.random()
            .toString(36)
            .slice(2)
    );

}

function escapeHTML(value) {

    return String(value ?? "")
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );

}

/* =========================================================
   OVERLAYS, CONFIRM DIALOG & SETTINGS
   ========================================================= */

let confirmResolver = null;

function openOverlay(id, focusSelector) {

    const overlay = $("#" + id);

    if (!overlay) return;

    overlay._opener = document.activeElement;

    overlay.classList.add("active");

    document.body.style.overflow = "hidden";

    setTimeout(() => {

        $(focusSelector || "input, button", overlay)?.focus();

    }, 250);

    refreshIcons();

}

function closeOverlay(id) {

    const overlay = $("#" + id);

    if (!overlay) return;

    overlay.classList.remove("active");

    if (!$(".sheet-overlay.active")) {
        document.body.style.overflow = "";
    }

    overlay._opener?.focus?.();

}

function dismissOverlay(id) {

    if (id === "confirmDialog") {
        resolveConfirm(false);
    } else {
        closeOverlay(id);
    }

}

function confirmAction({ title, message, confirmText = "Ya" }) {

    return new Promise(resolve => {

        $("#confirmTitle").textContent = title;
        $("#confirmMessage").textContent = message;
        $("#confirmAccept").textContent = confirmText;

        confirmResolver = resolve;

        openOverlay("confirmDialog", "#confirmCancel");

    });

}

function resolveConfirm(value) {

    if (!confirmResolver) return;

    const resolve = confirmResolver;

    confirmResolver = null;

    closeOverlay("confirmDialog");

    resolve(value);

}

function initializeSheets() {

    $$(".sheet-overlay").forEach(overlay => {

        overlay.addEventListener("click", event => {

            if (event.target === overlay) {
                dismissOverlay(overlay.id);
            }

        });

    });

    $$("[data-close-sheet]").forEach(button => {

        button.addEventListener("click", () => {
            dismissOverlay(button.dataset.closeSheet);
        });

    });

    $("#confirmCancel")
        ?.addEventListener("click", () => resolveConfirm(false));

    $("#confirmAccept")
        ?.addEventListener("click", () => resolveConfirm(true));

    document.addEventListener("keydown", event => {

        const top = $$(".sheet-overlay.active").at(-1);

        if (!top) return;

        if (event.key === "Escape") {

            dismissOverlay(top.id);

            return;

        }

        if (event.key !== "Tab") return;

        const focusable =
            $$("button, input, select, [tabindex]:not([tabindex='-1'])", top)
                .filter(el => !el.disabled && el.offsetParent !== null);

        if (!focusable.length) return;

        const first = focusable[0];
        const last = focusable.at(-1);

        if (event.shiftKey && document.activeElement === first) {

            event.preventDefault();
            last.focus();

        } else if (!event.shiftKey && document.activeElement === last) {

            event.preventDefault();
            first.focus();

        }

    });

}

function initializeSettings() {

    $("#settingsButton")?.addEventListener("click", () => {

        const input = $("#settingsName");

        if (input) input.value = state.settings.userName || "";

        const region = $("#settingsRegion");

        if (region) region.value = getRegion().code;

        openOverlay("settingsSheet", "#settingsName");

    });

    $("#saveSettings")?.addEventListener("click", async () => {

        const name = $("#settingsName")?.value.trim();

        const newRegion =
            $("#settingsRegion")?.value || getRegion().code;

        if (
            REGIONS[newRegion] &&
            newRegion !== getRegion().code
        ) {

            const changed =
                await changeRegion(newRegion);

            if (!changed) return;

        }

        state.settings.userName = name || "Pengguna";

        saveSettings();

        closeOverlay("settingsSheet");

        renderUser();

        showToast("Pengaturan disimpan.", "success");

    });

}

/*
 * Mengganti region = mengganti mata uang.
 * Nominal yang tersimpan tidak punya kode mata uang dan tidak
 * dikonversi, jadi transaksi lama dikosongkan atas persetujuan pengguna.
 */
async function changeRegion(code) {

    const target = REGIONS[code];

    if (state.transactions.length > 0) {

        const ok = await confirmAction({
            title: `Ganti ke ${target.currency}?`,
            message:
                "Transaksi yang sudah tercatat tidak dikonversi. " +
                `Nominalnya akan terbaca sebagai ${target.symbol}, ` +
                "sehingga angkanya tidak lagi sesuai. " +
                "Semua transaksi saat ini akan dihapus permanen.",
            confirmText: "Ganti & hapus data"
        });

        if (!ok) return false;

        state.transactions = [];

        saveTransactions();

    }

    state.settings.region = code;

    applyRegionToUI();

    renderApplication();

    refreshIcons();

    return true;

}

/* Menyesuaikan elemen statis (simbol, placeholder, keyboard) dengan region. */
function applyRegionToUI() {

    const region = getRegion();

    const { decimal } = getSeparators(region);

    const currencyLabel = $("#amountCurrency");

    if (currencyLabel) currencyLabel.textContent = region.symbol;

    const amountInput = $("#transactionAmount");

    if (amountInput) {

        amountInput.setAttribute(
            "inputmode",
            region.decimals > 0 ? "decimal" : "numeric"
        );

        amountInput.placeholder =
            region.decimals > 0
                ? `0${decimal}${"0".repeat(region.decimals)}`
                : "0";

        amountInput.value = "";

    }

    const fill = $("#zakatFillButton");

    if (fill) fill.hidden = region.code !== "ID";

    renderZakatNote();

}

/* =========================================================
   ZAKAT PENGHASILAN
   ========================================================= */

/*
 * Nisab ditetapkan BAZNAS setiap tahun (setara 85 gram emas).
 * Perbarui nilai ini ketika ada ketetapan baru.
 * Sumber: SK Ketua BAZNAS No. 15 Tahun 2026.
 */
/* Kalkulator zakat selalu dalam Rupiah (mengikuti BAZNAS Indonesia). */
function formatZakat(value) {

    return formatCurrency(value, REGIONS.ID);

}

const ZAKAT_CONFIG = {
    year: 2026,
    nisabMonthly: 7640144,
    nisabYearly: 91681728,
    rate: 0.025
};

function initializeZakat() {

    const inputs = ["#zakatSalary", "#zakatOther", "#zakatDebt"]
        .map(selector => $(selector))
        .filter(Boolean);

    inputs.forEach(input => {

        input.addEventListener("input", () => {

            formatAmountInput(input, REGIONS.ID);

            renderZakat();

        });

    });

    $("#zakatFillButton")?.addEventListener("click", () => {

        const income =
            calculateIncome(getCurrentMonthTransactions());

        if (income <= 0) {

            showToast(
                "Belum ada pemasukan yang tercatat bulan ini.",
                "info"
            );

            return;

        }

        $("#zakatSalary").value =
            new Intl.NumberFormat("id-ID").format(income);

        renderZakat();

    });

    renderZakatNote();

    renderZakat();

}

function renderZakatNote() {

    const note = $("#zakatNote");

    if (!note) return;

    let text =
        `Nisab ${ZAKAT_CONFIG.year} menurut BAZNAS: ` +
        `${formatZakat(ZAKAT_CONFIG.nisabMonthly)} per bulan ` +
        `(${formatZakat(ZAKAT_CONFIG.nisabYearly)} per tahun). ` +
        "Perhitungan ini hanya panduan; ulama berbeda pendapat soal " +
        "pengurangan kebutuhan pokok, jadi konsultasikan dengan BAZNAS " +
        "atau lembaga amil zakat terpercaya.";

    if (getRegion().code !== "ID") {

        text +=
            " Kalkulator ini selalu memakai Rupiah (Rp) dan ketentuan " +
            `Indonesia, terpisah dari mata uang aplikasi (${getRegion().currency}).`;

    }

    note.textContent = text;

}

function renderZakat() {

    const box = $("#zakatResult");

    if (!box) return;

    const salary = parseAmount($("#zakatSalary")?.value, REGIONS.ID);
    const other = parseAmount($("#zakatOther")?.value, REGIONS.ID);
    const debt = parseAmount($("#zakatDebt")?.value, REGIONS.ID);

    const gross = salary + other;

    if (gross <= 0) {

        box.innerHTML =
            `<p class="zakat-hint">Isi penghasilanmu untuk melihat perhitungan zakat.</p>`;

        return;

    }

    const net = Math.max(0, gross - debt);

    const due = net >= ZAKAT_CONFIG.nisabMonthly;

    const zakat =
        due ? Math.round(net * ZAKAT_CONFIG.rate) : 0;

    const hint = due
        ? `2,5% dari ${formatZakat(net)}. Jika penghasilanmu sama setiap bulan, perkiraan zakat setahun sekitar ${formatZakat(zakat * 12)}.`
        : `Penghasilan yang dihitung masih di bawah nisab bulanan. Zakat belum wajib bulan ini, tetapi jika total penghasilanmu dalam setahun mencapai ${formatZakat(ZAKAT_CONFIG.nisabYearly)}, zakat 2,5% dihitung dari total setahun. Sedekah tetap dianjurkan.`;

    box.innerHTML = `
        <div class="zakat-status">

            <div>
                <span class="zakat-label">Zakat yang perlu ditunaikan</span>
                <strong>${formatZakat(zakat)}</strong>
            </div>

            <span class="net-status ${due ? "positive" : "neutral"}">
                ${due ? "Wajib zakat" : "Belum wajib"}
            </span>

        </div>

        <div class="zakat-lines">

            <div class="zakat-line">
                <span>Total penghasilan</span>
                <strong>${formatZakat(gross)}</strong>
            </div>

            ${debt > 0 ? `
            <div class="zakat-line">
                <span>Cicilan utang jatuh tempo</span>
                <strong>- ${formatZakat(debt)}</strong>
            </div>` : ""}

            <div class="zakat-line">
                <span>Penghasilan yang dihitung</span>
                <strong>${formatZakat(net)}</strong>
            </div>

            <div class="zakat-line">
                <span>Nisab per bulan</span>
                <strong>${formatZakat(ZAKAT_CONFIG.nisabMonthly)}</strong>
            </div>

        </div>

        <p class="zakat-hint">${hint}</p>
    `;

}

/* =========================================================
   INSTALL APP (PWA)
   ========================================================= */

let deferredInstallPrompt = null;

const PWA_FLAGS = {
    offlineReady: "budgetflow_offline_ready",
    installCardDismissed: "budgetflow_install_dismissed",
    iosInstalled: "budgetflow_ios_installed"
};

function readFlag(key) {

    try {
        return localStorage.getItem(key) === "1";
    } catch (error) {
        return false;
    }

}

function writeFlag(key) {

    try {
        localStorage.setItem(key, "1");
    } catch (error) {
        /* ignore */
    }

}

function isStandaloneApp() {

    return (
        window.matchMedia("(display-mode: standalone)").matches ||
        navigator.standalone === true
    );

}

function isIOSDevice() {

    return (
        /iphone|ipad|ipod/i.test(navigator.userAgent) ||
        (
            navigator.platform === "MacIntel" &&
            navigator.maxTouchPoints > 1
        )
    );

}

function updateInstallButtons() {

    const hideAll = isStandaloneApp();

    $$("[data-install-wrap]").forEach(element => {

        const isCard = element.id === "installCard";

        element.hidden =
            hideAll ||
            (isCard && readFlag(PWA_FLAGS.installCardDismissed));

    });

}

function showInstallInstructions() {

    const intro = $("#installIntro");
    const steps = $("#installSteps");

    if (!intro || !steps) return;

    const list = isIOSDevice()
        ? [
            "Buka situs ini di Safari.",
            "Ketuk tombol Bagikan (ikon kotak dengan panah ke atas).",
            "Pilih \"Tambah ke Layar Utama\", lalu ketuk Tambah."
        ]
        : [
            "Buka menu browser (ikon titik tiga atau menu di pojok).",
            "Pilih \"Instal aplikasi\" atau \"Tambahkan ke layar utama\".",
            "Konfirmasi untuk menambahkannya."
        ];

    intro.textContent =
        "Browser ini belum menampilkan jendela instal otomatis. " +
        "Ikuti langkah berikut untuk memasang BudgetFlow:";

    steps.innerHTML =
        list.map(item => `<li>${escapeHTML(item)}</li>`).join("");

    closeOverlay("settingsSheet");

    openOverlay("installSheet", "[data-close-sheet]");

}

async function handleInstallClick() {

    if (!window.isSecureContext) {

        showToast(
            "Instal hanya tersedia jika situs dibuka lewat HTTPS.",
            "warning"
        );

        return;

    }

    if (!deferredInstallPrompt) {

        showInstallInstructions();

        return;

    }

    const promptEvent = deferredInstallPrompt;

    deferredInstallPrompt = null;

    promptEvent.prompt();

    const choice = await promptEvent.userChoice;

    if (choice && choice.outcome === "dismissed") {

        showToast("Instalasi dibatalkan.", "info");

    }

}

function initializePWA() {

    $$("[data-install]").forEach(button => {

        button.addEventListener("click", handleInstallClick);

    });

    $("#installDismiss")?.addEventListener("click", () => {

        writeFlag(PWA_FLAGS.installCardDismissed);

        updateInstallButtons();

    });

    window.addEventListener("beforeinstallprompt", event => {

        event.preventDefault();

        deferredInstallPrompt = event;

    });

    window.addEventListener("appinstalled", () => {

        deferredInstallPrompt = null;

        updateInstallButtons();

        showToast(
            "BudgetFlow berhasil diinstal. Buka dari layar utama atau daftar aplikasi.",
            "success",
            "Instal berhasil"
        );

    });

    updateInstallButtons();

    /*
     * iOS does not fire "appinstalled", so confirm on the
     * first launch from the home screen instead.
     */
    if (
        isStandaloneApp() &&
        isIOSDevice() &&
        !readFlag(PWA_FLAGS.iosInstalled)
    ) {

        writeFlag(PWA_FLAGS.iosInstalled);

        showToast(
            "BudgetFlow berhasil diinstal dan siap dipakai.",
            "success",
            "Instal berhasil"
        );

    }

    if (
        "serviceWorker" in navigator &&
        window.isSecureContext
    ) {

        navigator.serviceWorker
            .register("sw.js")
            .catch(error => {
                console.error("BudgetFlow: service worker gagal.", error);
            });

        navigator.serviceWorker.ready
            .then(() => {

                if (!readFlag(PWA_FLAGS.offlineReady)) {

                    writeFlag(PWA_FLAGS.offlineReady);

                    showToast(
                        "Aplikasi sudah tersimpan dan bisa dipakai tanpa internet.",
                        "success",
                        "Siap offline"
                    );

                }

            })
            .catch(() => {});

    }

}

function refreshIcons() {

    if (
        window.lucide &&
        typeof lucide.createIcons ===
            "function"
    ) {

        lucide.createIcons();

    }

}

/* =========================================================
   27. KEYBOARD SHORTCUT
   ========================================================= */

document.addEventListener(
    "keydown",
    event => {

        /*
         * Press "+" to open transaction form.
         * Ignore when typing in an input/select.
         */

        if (
            event.key === "+" &&
            !$(".sheet-overlay.active") &&
            !["INPUT", "TEXTAREA", "SELECT"]
                .includes(
                    document.activeElement?.tagName
                )
        ) {

            event.preventDefault();

            openTransactionSheet();

        }

    }
);

/* =========================================================
   28. DEBUG API
   ========================================================= */

window.BudgetFlow = {

    state,

    getBalance() {
        return calculateBalance();
    },

    getTransactions() {
        return [...state.transactions];
    },

    clearTransactions() {

        state.transactions = [];

        saveTransactions();

        renderApplication();

        showToast(
            "Semua transaksi telah dihapus.",
            "success"
        );

    },

    resetDemo() {

        state.transactions =
            createDemoTransactions();

        saveTransactions();

        renderApplication();

        showToast(
            "Data demo berhasil dipulihkan.",
            "success"
        );

    },

    addTransaction({
        type = "expense",
        amount = 0,
        category = "other",
        note = "",
        date = formatDateForInput(
            new Date()
        )
    } = {}) {

        const transaction = {

            id: cryptoId(),

            type:
                type === "income"
                    ? "income"
                    : "expense",

            amount:
                Number(amount) || 0,

            category,

            note,

            date,

            createdAt:
                Date.now()

        };

        state.transactions.push(
            transaction
        );

        saveTransactions();

        renderApplication();

        return transaction;

    }

};

/* =========================================================
   END OF BUDGETFLOW 2.0
   ========================================================= */
