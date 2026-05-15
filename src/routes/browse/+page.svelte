<script lang="ts">
  import {
    createQuery,
    createMutation,
    useQueryClient,
  } from "@tanstack/svelte-query";
  import { derived, writable } from "svelte/store";
  import { inkApi } from "$lib/services/ink-api";
  import type {
    InkBrowseNode,
    BrowseNodeKind,
    BrowseNodeMode,
    BrowseNodeVisibility,
    BrowseNodePayload,
  } from "$lib/services/ink-api";
  import { Check, Plus, Trash2, AlertCircle } from "lucide-svelte";
  import FilterPicker from "$lib/components/ink/FilterPicker.svelte";
  import PlacementPicker from "$lib/components/ink/PlacementPicker.svelte";
  import ParentPicker from "$lib/components/ink/ParentPicker.svelte";
  import BrowseTree from "$lib/components/ink/BrowseTree.svelte";

  const queryClient = useQueryClient();

  // --- Node list query ---
  const nodesQuery = createQuery({
    queryKey: ["ink", "browse_nodes"],
    queryFn: () => inkApi.listBrowseNodes(),
  });

  // --- Selection state ---
  let selectedId = $state<string | null>(null);
  let creatingNew = $state(false);

  // TanStack uses stores, not runes — wrap selectedId in a store for the
  // detail query, same pattern as the lab page (selectedIdStore).
  const selectedIdStore = writable<string | null>(null);
  $effect(() => {
    selectedIdStore.set(selectedId);
  });

  const detailQuery = createQuery(
    derived(selectedIdStore, ($id) => ({
      queryKey: ["ink", "browse_node", $id] as const,
      queryFn: () =>
        $id ? inkApi.getBrowseNode($id) : Promise.reject("no id"),
      enabled: !!$id,
    })),
  );

  let detailNode = $derived($detailQuery.data ?? null);

  // --- Form state ---
  // The form mirrors detailNode (for an existing node) or starts empty (for a new draft).
  // Dirty tracking: any form field divergence from the loaded node counts as dirty.
  // For create mode, any non-empty field counts as dirty.
  let form = $state<BrowseNodePayload & { parent_ids_text: string; filters_text: string; placement_text: string }>(
    blankForm(),
  );
  let initialFormSnapshot = $state("");
  let formError = $state<string | null>(null);
  let jsonError = $state<{ filters: string | null; placement: string | null }>(
    { filters: null, placement: null },
  );

  function blankForm(): BrowseNodePayload & {
    parent_ids_text: string;
    filters_text: string;
    placement_text: string;
  } {
    return {
      slug: "",
      name: "",
      description: "",
      kind: "hub" as BrowseNodeKind,
      query: "",
      mode: "hybrid" as BrowseNodeMode,
      filters: {},
      placement: {},
      visibility: "draft" as BrowseNodeVisibility,
      parent_ids: [],
      position: null,
      parent_ids_text: "",
      filters_text: "{}",
      placement_text: "{}",
    };
  }

  function nodeToForm(
    n: InkBrowseNode,
  ): BrowseNodePayload & {
    parent_ids_text: string;
    filters_text: string;
    placement_text: string;
  } {
    return {
      slug: n.slug ?? "",
      name: n.name ?? "",
      description: n.description ?? "",
      kind: n.kind,
      query: n.query ?? "",
      mode: n.mode,
      filters: n.filters ?? {},
      placement: n.placement ?? {},
      visibility: n.visibility,
      parent_ids: n.parent_ids ?? [],
      position: n.position ?? null,
      parent_ids_text: (n.parent_ids ?? []).join(", "),
      filters_text: JSON.stringify(n.filters ?? {}, null, 2),
      placement_text: JSON.stringify(n.placement ?? {}, null, 2),
    };
  }

  function formSnapshot(
    f: typeof form,
  ): string {
    return JSON.stringify({
      slug: f.slug,
      name: f.name,
      description: f.description,
      kind: f.kind,
      query: f.query,
      mode: f.mode,
      visibility: f.visibility,
      position: f.position,
      parent_ids_text: f.parent_ids_text,
      filters_text: f.filters_text,
      placement_text: f.placement_text,
    });
  }

  // Reset the form whenever the loaded detail changes.
  $effect(() => {
    if (detailNode && !creatingNew) {
      const nextForm = nodeToForm(detailNode);
      form = nextForm;
      initialFormSnapshot = formSnapshot(nextForm);
      formError = null;
      jsonError = { filters: null, placement: null };
    }
  });

  let isDirty = $derived(
    creatingNew
      ? formSnapshot(form) !== formSnapshot(blankForm())
      : initialFormSnapshot !== "" &&
          formSnapshot(form) !== initialFormSnapshot,
  );

  // --- Mutations ---
  const saveMutation = createMutation({
    mutationFn: async () => {
      const payload = buildPayloadFromForm();
      if (!payload) {
        throw new Error("Fix validation errors before saving.");
      }
      if (creatingNew) {
        return inkApi.createBrowseNode(payload);
      }
      if (!selectedId) throw new Error("No node selected.");
      return inkApi.updateBrowseNode(selectedId, payload);
    },
    onSuccess: (result) => {
      formError = null;
      creatingNew = false;
      if (result) selectedId = result.id;
      queryClient.invalidateQueries({ queryKey: ["ink", "browse_nodes"] });
      if (result) {
        queryClient.invalidateQueries({
          queryKey: ["ink", "browse_node", result.id],
        });
      }
      showToast("Browse node saved", "success");
    },
    onError: (err: Error) => {
      formError = err.message || "Save failed";
      showToast(`Save failed: ${formError}`, "error");
    },
  });

  const deleteMutation = createMutation({
    mutationFn: (id: string) => inkApi.deleteBrowseNode(id),
    onSuccess: () => {
      selectedId = null;
      creatingNew = false;
      queryClient.invalidateQueries({ queryKey: ["ink", "browse_nodes"] });
      showToast("Browse node deleted", "success");
    },
    onError: (err: Error) => {
      showToast(`Delete failed: ${err.message}`, "error");
    },
  });

  function buildPayloadFromForm(): BrowseNodePayload | null {
    // Parse JSON fields
    let filters: Record<string, unknown> = {};
    let placement: Record<string, unknown> = {};
    let nextJsonError = { filters: null as string | null, placement: null as string | null };

    try {
      filters = form.filters_text.trim() ? JSON.parse(form.filters_text) : {};
      if (typeof filters !== "object" || filters === null || Array.isArray(filters)) {
        nextJsonError.filters = "Filters must be a JSON object.";
      }
    } catch (e) {
      nextJsonError.filters = `Invalid JSON: ${(e as Error).message}`;
    }

    try {
      placement = form.placement_text.trim() ? JSON.parse(form.placement_text) : {};
      if (typeof placement !== "object" || placement === null || Array.isArray(placement)) {
        nextJsonError.placement = "Placement must be a JSON object.";
      }
    } catch (e) {
      nextJsonError.placement = `Invalid JSON: ${(e as Error).message}`;
    }

    jsonError = nextJsonError;
    if (nextJsonError.filters || nextJsonError.placement) return null;

    const parent_ids = form.parent_ids_text
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    return {
      slug: form.slug?.trim() || undefined,
      name: form.name?.trim() || undefined,
      description: form.description?.trim() || null,
      kind: form.kind,
      query: form.query?.trim() || null,
      mode: form.mode,
      filters,
      placement,
      visibility: form.visibility,
      parent_ids,
      position: form.position ?? null,
    };
  }

  // --- Tree grouping ---
  // First-pass UI: render as a flat list grouped by kind. Sub-hubs nest under
  // their first parent hub. Collection items nest under their first parent group.
  // Cross-assignment is shown via the parent_ids text input on the detail panel.
  // Tree node carries its own children, recursively. A collection_group may
  // contain both collection_items and nested collection_groups (e.g.
  // Presidential Documents under Policy & Strategy — spec §6.4 + §23 Q1).
  // The render template recurses on `childList`, so depth is open-ended even
  // though current V1.0 taxonomy only uses three levels for the Presidential
  // Documents case.
  type TreeNode = InkBrowseNode & { childList: TreeNode[] };
  type TreeBucket = {
    label: string;
    nodes: TreeNode[];
  };

  let tree = $derived(buildTree($nodesQuery.data ?? []));

  function buildTree(nodes: InkBrowseNode[]): TreeBucket[] {
    const byId = new Map<string, InkBrowseNode>();
    for (const n of nodes) byId.set(n.id, n);

    const hubs = nodes.filter((n) => n.kind === "hub");
    const subHubs = nodes.filter((n) => n.kind === "sub_hub");
    const groups = nodes.filter((n) => n.kind === "collection_group");
    const items = nodes.filter((n) => n.kind === "collection_item");

    const sortByPos = (a: InkBrowseNode, b: InkBrowseNode) => {
      const ap = a.position ?? 0;
      const bp = b.position ?? 0;
      if (ap !== bp) return ap - bp;
      return (a.name ?? "").localeCompare(b.name ?? "");
    };

    // Recursive: build a TreeNode for `parent`, walking its children
    // through any candidate kinds. Used for both the hubs subtree (hub →
    // sub_hubs) and the collection groups subtree (group → items +
    // nested groups → admin items).
    const buildSubtree = (
      parent: InkBrowseNode,
      candidates: InkBrowseNode[],
    ): TreeNode => {
      const childNodes = candidates
        .filter((c) => (c.parent_ids ?? []).includes(parent.id))
        .sort(sortByPos);
      return {
        ...parent,
        childList: childNodes.map((c) => buildSubtree(c, candidates)),
      };
    };

    // Top-level collection_groups: those whose parents are NOT themselves
    // collection_groups. Nested groups (Presidential Documents) attach
    // under their parent group instead of floating at top level.
    const groupParentIds = new Set(groups.map((g) => g.id));
    const topLevelGroups = groups.filter(
      (g) => !(g.parent_ids ?? []).some((pid) => groupParentIds.has(pid)),
    );
    // Candidates for a group's children: all items + all nested groups.
    const groupCandidates = [...items, ...groups];

    const hubBucket: TreeBucket = {
      label: "Hubs",
      nodes: hubs.sort(sortByPos).map((h) => buildSubtree(h, subHubs)),
    };
    const groupBucket: TreeBucket = {
      label: "Collection Groups",
      nodes: topLevelGroups
        .sort(sortByPos)
        .map((g) => buildSubtree(g, groupCandidates)),
    };

    const orphanSubHubs = subHubs.filter(
      (s) =>
        (s.parent_ids ?? []).length === 0 ||
        !(s.parent_ids ?? []).some((pid) => byId.get(pid)?.kind === "hub"),
    );
    const orphanItems = items.filter(
      (i) =>
        (i.parent_ids ?? []).length === 0 ||
        !(i.parent_ids ?? []).some(
          (pid) => byId.get(pid)?.kind === "collection_group",
        ),
    );

    const buckets: TreeBucket[] = [hubBucket, groupBucket];
    if (orphanSubHubs.length || orphanItems.length) {
      buckets.push({
        label: "Unparented",
        nodes: [...orphanSubHubs, ...orphanItems]
          .sort(sortByPos)
          .map((n) => ({ ...n, childList: [] })),
      });
    }
    return buckets;
  }

  // --- Selection / unsaved-changes guard ---
  function trySelect(id: string) {
    if (id === selectedId && !creatingNew) return;
    if (isDirty) {
      const ok = confirm(
        "You have unsaved changes. Discard them and load this node?",
      );
      if (!ok) return;
    }
    creatingNew = false;
    selectedId = id;
  }

  function startNew() {
    if (isDirty) {
      const ok = confirm(
        "You have unsaved changes. Discard them and start a new node?",
      );
      if (!ok) return;
    }
    selectedId = null;
    creatingNew = true;
    form = blankForm();
    initialFormSnapshot = formSnapshot(blankForm());
    formError = null;
    jsonError = { filters: null, placement: null };
  }

  function cancelEdit() {
    if (creatingNew) {
      creatingNew = false;
      form = blankForm();
      initialFormSnapshot = "";
    } else if (detailNode) {
      form = nodeToForm(detailNode);
      initialFormSnapshot = formSnapshot(form);
    }
    formError = null;
    jsonError = { filters: null, placement: null };
  }

  function confirmDelete() {
    if (!selectedId || !detailNode) return;
    const ok = confirm(
      `Delete "${detailNode.name || detailNode.slug}"? This is a soft-delete and can be reversed by an admin.`,
    );
    if (!ok) return;
    $deleteMutation.mutate(selectedId);
  }

  // Auto-derive slug from name on create (until the user touches the slug field).
  let slugTouched = $state(false);
  function onNameInput(value: string) {
    form = { ...form, name: value };
    if (creatingNew && !slugTouched) {
      form = { ...form, slug: slugify(value) };
    }
  }

  function slugify(s: string): string {
    return s
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  // --- Toast ---
  let toastMessage = $state("");
  let toastType = $state<"success" | "error">("success");
  let toastVisible = $state(false);
  let toastTimer: ReturnType<typeof setTimeout> | null = null;

  function showToast(message: string, type: "success" | "error") {
    if (toastTimer) clearTimeout(toastTimer);
    toastMessage = message;
    toastType = type;
    toastVisible = true;
    toastTimer = setTimeout(() => {
      toastVisible = false;
    }, 3000);
  }

  // --- Keyboard shortcuts ---
  function handleKeydown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === "s") {
      e.preventDefault();
      if (isDirty && !$saveMutation.isPending) $saveMutation.mutate();
    }
  }

  function kindLabel(k: BrowseNodeKind): string {
    switch (k) {
      case "hub":
        return "Hub";
      case "sub_hub":
        return "Sub-hub";
      case "collection_group":
        return "Group";
      case "collection_item":
        return "Item";
    }
  }
</script>

<svelte:head>
  <title>Browse Navigation Editor | INK</title>
</svelte:head>

<svelte:window onkeydown={handleKeydown} />

<!-- Header -->
<div class="flex items-center justify-between mb-3">
  <div>
    <h1 class="text-lg font-bold text-text-theme-primary">Browse Navigation Editor</h1>
    <p class="text-[11px] text-text-theme-tertiary mt-0.5 leading-snug">
      Author hubs, sub-hubs, collection groups, and items. Each node is a named
      search.
    </p>
  </div>
</div>

<!-- Two-column layout -->
<div class="grid grid-cols-[320px_1fr] gap-4">
  <!-- LEFT: Tree rail -->
  <aside
    class="card p-3 lg:sticky lg:top-3 lg:self-start lg:max-h-[calc(100vh-1.5rem)] lg:overflow-y-auto"
  >
    <div class="flex items-center justify-between mb-3">
      <h2 class="text-xs font-semibold text-text-theme-secondary uppercase tracking-wide">
        Browse Tree
      </h2>
      <button
        type="button"
        class="btn btn-primary text-xs py-1 px-2.5"
        onclick={startNew}
      >
        <Plus size={12} />
        New
      </button>
    </div>

    {#if $nodesQuery.isPending}
      <div class="space-y-2">
        {#each Array(6) as _}
          <div class="skeleton h-6 w-full rounded"></div>
        {/each}
      </div>
    {:else if $nodesQuery.isError}
      <div class="text-xs text-red-600 flex items-start gap-2">
        <AlertCircle size={14} class="flex-shrink-0 mt-0.5" />
        <div>
          <p class="font-medium">Failed to load tree</p>
          <p class="text-text-theme-tertiary mt-1">
            {$nodesQuery.error.message}
          </p>
          <button
            class="btn btn-outline text-[11px] py-0.5 px-2 mt-2"
            onclick={() => $nodesQuery.refetch()}
          >
            Retry
          </button>
        </div>
      </div>
    {:else if !($nodesQuery.data?.length)}
      <div class="text-xs text-text-theme-tertiary py-4 text-center">
        No browse nodes yet. Click <b>New</b> to create one.
      </div>
    {:else}
      <BrowseTree
        buckets={tree}
        {selectedId}
        {creatingNew}
        userId="anon"
        onselect={(id) => trySelect(id)}
        onreordered={() => queryClient.invalidateQueries({ queryKey: ["ink", "browse_nodes"] })}
      />
    {/if}
  </aside>

  <!-- RIGHT: Detail editor -->
  <section class="card p-4">
    {#if creatingNew || detailNode}
      {#if formError}
        <div class="mb-3 p-2 rounded border border-red-500/50 bg-red-500/10 text-xs text-red-700 dark:text-red-300 flex items-start gap-2">
          <AlertCircle size={14} class="flex-shrink-0 mt-0.5" />
          <span>{formError}</span>
        </div>
      {/if}

      <div class="flex items-center justify-between mb-4">
        <h2 class="text-base font-semibold text-text-theme-primary">
          {creatingNew ? "New browse node" : detailNode?.name || "Untitled"}
        </h2>
        <div class="flex gap-1.5">
          {#if !creatingNew && selectedId}
            <button
              type="button"
              class="btn btn-outline text-xs py-1 px-2.5 text-red-600 hover:text-red-700"
              onclick={confirmDelete}
              disabled={$deleteMutation.isPending}
              title="Soft-delete this node"
            >
              <Trash2 size={12} />
              Delete
            </button>
          {/if}
          {#if isDirty}
            <button
              type="button"
              class="btn btn-outline text-xs py-1 px-2.5"
              onclick={cancelEdit}
            >
              Cancel
            </button>
          {/if}
          <button
            type="button"
            class="btn btn-primary text-xs py-1 px-2.5"
            disabled={!isDirty || $saveMutation.isPending}
            onclick={() => $saveMutation.mutate()}
          >
            {$saveMutation.isPending ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      <form class="space-y-3" onsubmit={(e) => e.preventDefault()}>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label
              class="block text-xs font-medium text-text-theme-secondary mb-1"
              for="bn-name">Name</label
            >
            <input
              id="bn-name"
              type="text"
              class="input input-compact"
              value={form.name ?? ""}
              oninput={(e) =>
                onNameInput((e.currentTarget as HTMLInputElement).value)}
              placeholder="Threats & Hazards"
            />
          </div>
          <div>
            <label
              class="block text-xs font-medium text-text-theme-secondary mb-1"
              for="bn-slug">Slug</label
            >
            <input
              id="bn-slug"
              type="text"
              class="input input-compact"
              value={form.slug ?? ""}
              oninput={(e) => {
                slugTouched = true;
                form = {
                  ...form,
                  slug: (e.currentTarget as HTMLInputElement).value,
                };
              }}
              placeholder="threats-hazards"
            />
            {#if !creatingNew && detailNode && form.slug !== detailNode.slug}
              <p class="text-[10px] text-amber-600 mt-1">
                Changing the slug after publish breaks existing URLs.
              </p>
            {/if}
          </div>
        </div>

        <div>
          <label
            class="block text-xs font-medium text-text-theme-secondary mb-1"
            for="bn-description">Description</label
          >
          <textarea
            id="bn-description"
            class="input"
            rows="2"
            value={form.description ?? ""}
            oninput={(e) =>
              (form = {
                ...form,
                description: (e.currentTarget as HTMLTextAreaElement).value,
              })}
            placeholder="One-line summary used on cards and as the page subtitle."
          ></textarea>
        </div>

        <div class="grid grid-cols-3 gap-3">
          <div>
            <label
              class="block text-xs font-medium text-text-theme-secondary mb-1"
              for="bn-kind">Kind</label
            >
            <select
              id="bn-kind"
              class="input input-compact"
              value={form.kind}
              onchange={(e) =>
                (form = {
                  ...form,
                  kind: (e.currentTarget as HTMLSelectElement)
                    .value as BrowseNodeKind,
                })}
            >
              <option value="hub">Hub</option>
              <option value="sub_hub">Sub-hub</option>
              <option value="collection_group">Collection group</option>
              <option value="collection_item">Collection item</option>
            </select>
          </div>
          <div>
            <label
              class="block text-xs font-medium text-text-theme-secondary mb-1"
              for="bn-mode">Mode</label
            >
            <select
              id="bn-mode"
              class="input input-compact"
              value={form.mode}
              onchange={(e) =>
                (form = {
                  ...form,
                  mode: (e.currentTarget as HTMLSelectElement)
                    .value as BrowseNodeMode,
                })}
            >
              <option value="hybrid">Hybrid</option>
              <option value="keyword">Keyword</option>
            </select>
          </div>
          <div>
            <label
              class="block text-xs font-medium text-text-theme-secondary mb-1"
              for="bn-visibility">Visibility</label
            >
            <select
              id="bn-visibility"
              class="input input-compact"
              value={form.visibility}
              onchange={(e) =>
                (form = {
                  ...form,
                  visibility: (e.currentTarget as HTMLSelectElement)
                    .value as BrowseNodeVisibility,
                })}
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </div>
        </div>

        <div class="grid grid-cols-[1fr_120px] gap-3">
          <div>
            <label class="block text-xs font-medium text-text-theme-secondary mb-1">Parents</label>
            <ParentPicker
              parentIds={form.parent_ids_text
                .split(",")
                .map((s) => s.trim())
                .filter((s) => s.length > 0)}
              nodeKind={form.kind}
              nodeId={selectedId}
              onchange={(next) =>
                (form = {
                  ...form,
                  parent_ids_text: next.join(", "),
                })}
            />
          </div>
          <div>
            <label
              class="block text-xs font-medium text-text-theme-secondary mb-1"
              for="bn-position">Position</label
            >
            <input
              id="bn-position"
              type="number"
              class="input input-compact"
              value={form.position ?? ""}
              oninput={(e) => {
                const v = (e.currentTarget as HTMLInputElement).value;
                form = {
                  ...form,
                  position: v === "" ? null : Number(v),
                };
              }}
              placeholder="0"
            />
          </div>
        </div>

        <div>
          <label
            class="block text-xs font-medium text-text-theme-secondary mb-1"
            for="bn-query">Query</label
          >
          <textarea
            id="bn-query"
            class="input font-mono text-[12px]"
            rows="2"
            value={form.query ?? ""}
            oninput={(e) =>
              (form = {
                ...form,
                query: (e.currentTarget as HTMLTextAreaElement).value,
              })}
            placeholder="The predetermined search string for this named search."
          ></textarea>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-medium text-text-theme-secondary mb-1">Filters</label>
            <FilterPicker
              filters={(() => {
                try {
                  return form.filters_text.trim() ? JSON.parse(form.filters_text) : {};
                } catch {
                  return {};
                }
              })()}
              onchange={(next) =>
                (form = {
                  ...form,
                  filters_text: JSON.stringify(next, null, 2),
                })}
            />
            {#if jsonError.filters}
              <p class="text-[10px] text-red-600 mt-1">{jsonError.filters}</p>
            {/if}
          </div>
          <div>
            <label class="block text-xs font-medium text-text-theme-secondary mb-1">Placement</label>
            <PlacementPicker
              placement={(() => {
                try {
                  return form.placement_text.trim() ? JSON.parse(form.placement_text) : {};
                } catch {
                  return {};
                }
              })()}
              onchange={(next) =>
                (form = {
                  ...form,
                  placement_text: JSON.stringify(next, null, 2),
                })}
            />
            {#if jsonError.placement}
              <p class="text-[10px] text-red-600 mt-1">{jsonError.placement}</p>
            {/if}
          </div>
        </div>

        {#if !creatingNew && detailNode}
          <div class="border-t border-theme pt-3 mt-3">
            <dl class="grid grid-cols-2 gap-2 text-[11px] text-text-theme-tertiary">
              <div>
                <dt class="font-semibold">ID</dt>
                <dd class="font-mono break-all">{detailNode.id}</dd>
              </div>
              {#if detailNode.updated_at}
                <div>
                  <dt class="font-semibold">Updated</dt>
                  <dd>{new Date(detailNode.updated_at).toLocaleString()}</dd>
                </div>
              {/if}
              {#if detailNode.children?.length}
                <div class="col-span-2">
                  <dt class="font-semibold">Children ({detailNode.children.length})</dt>
                  <dd>
                    {detailNode.children
                      .map((c) => c.name || c.slug)
                      .join(", ")}
                  </dd>
                </div>
              {/if}
            </dl>
          </div>
        {/if}
      </form>
    {:else if $detailQuery.isPending && selectedId}
      <div class="space-y-3">
        <div class="skeleton h-6 w-48 rounded"></div>
        <div class="skeleton h-4 w-32 rounded"></div>
        <div class="skeleton h-20 w-full rounded"></div>
        <div class="skeleton h-20 w-full rounded"></div>
      </div>
    {:else if $detailQuery.isError && selectedId}
      <div class="text-xs text-red-600 flex items-start gap-2">
        <AlertCircle size={14} class="flex-shrink-0 mt-0.5" />
        <div>
          <p class="font-medium">Failed to load node</p>
          <p class="text-text-theme-tertiary mt-1">
            {$detailQuery.error.message}
          </p>
        </div>
      </div>
    {:else}
      <div class="flex items-center justify-center min-h-[300px] text-center">
        <div class="text-text-theme-tertiary text-sm">
          Select a node from the left, or click
          <span class="inline-flex items-center gap-1 mx-1 font-medium text-text-theme-secondary">
            <Plus size={12} /> New
          </span>
          to create one.
        </div>
      </div>
    {/if}
  </section>
</div>

<!-- Toast -->
{#if toastVisible}
  <div
    class="fixed bottom-6 right-6 z-50 save-toast {toastType === 'success'
      ? 'bg-green-600'
      : 'bg-red-600'} text-white text-xs font-medium px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2"
  >
    {#if toastType === "success"}<Check size={14} />{/if}
    {toastMessage}
  </div>
{/if}

<style>
  .save-toast {
    animation: toast-in 200ms ease-out;
  }
  @keyframes toast-in {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
