import { api, readLocal, writeLocal } from "./reader-api.js";
import { escape as h } from "./components.js";

import { profileInput } from './profile-input.js';
export function setupStudy(paper, button) {
  const key = "lunjing.study." + paper.id;
  const state = readLocal(key, {});
  const dialog = document.createElement("dialog");
  dialog.className = "study-dialog";
  document.body.append(dialog);
  let plan,
    test,
    profile,
    busy = false;
  function render(message = "") {
    let body =
      '<p>根据手账已确认的画像和本篇章节生成阅读方案。</p><button data-do="create">生成阅读方案</button>';
    if (plan) {
      const p = plan.plan;
      body =
        '<label>阅读深度 <select id="plan-depth">' +
        ["看懂大意", "能讲清楚", "能复现"]
          .map(
            (d) =>
              "<option " +
              (p.depth === d ? "selected" : "") +
              ">" +
              d +
              "</option>",
          )
          .join("") +
        '</select></label> <button data-do="edit">保存深度</button><p>重点 · ' +
        p.focus.map(h).join("、") +
        "</p><ol>" +
        p.route
          .map(
            (r) =>
              "<li><strong>" +
              h(r.section) +
              "</strong> · " +
              h(r.mode) +
              "<br>" +
              h(r.goal) +
              "</li>",
          )
          .join("") +
        '</ol><p>在线出题会将本篇元数据、阅读目标和已确认画像发送至配置的模型服务。</p><button data-do="test">生成个性化读前测试</button>';
      body += ' <button data-do="create">按最新手账重新生成方案</button>';
      if (paper.id === "radiation")
        body += ' <button data-do="sample">练习已有五道样题</button>';
    }
    if (test && !profile) {
      body +=
        '<form id="study-answers"><h3>读前测试</h3>' +
        test.questions
          .map(
            (q) =>
              "<fieldset><legend>" +
              h(q.stem) +
              "</legend>" +
              Object.entries(q.options)
                .map(
                  ([k, v]) =>
                    '<label><input type="radio" required name="' +
                    h(q.id) +
                    '" value="' +
                    h(k) +
                    '" ' +
                    (state.choices?.[q.id] === k ? "checked" : "") +
                    "> " +
                    h(v) +
                    "</label>",
                )
                .join("") +
              "</fieldset>",
          )
          .join("") +
        '<button type="submit">提交作答</button></form>';
      if (test.skippable)
        body += ' <button data-do="skip">跳过本次测试</button>';
    }
    if (profile) {
      body +=
        "<h3>本篇读前画像</h3><p>" +
        ({
          submitted: "已提交作答",
          skipped: "已跳过本次测试",
          disabled: "本次未启用测试",
        }[profile.completion_status] || "已记录") +
        "</p><ul>" +
        profile.concept_evidence
          .map(
            (e) =>
              "<li>" +
              h(e.concept) +
              " · " +
              ({ mastered: "本题答对", gap: "建议补讲", unsure: "不确定" }[
                e.status
              ] || "待确认") +
              "</li>",
          )
          .join("") +
        "</ul>";
      for (const step of profile.step_support)
        body +=
          "<p>" +
          h(step.section) +
          " · " +
          step.actions.map((a) => h(a.concept)).join("、") +
          "</p>";
    }
    dialog.innerHTML =
      '<div class="study-top"><h2>阅读方案与测试</h2><button data-do="close">关闭</button></div><p role="status">' +
      h(message) +
      "</p>" +
      body;
  }
  function save() {
    writeLocal(key, state);
  }
  async function perform(fn) {
    if (busy) return;
    busy = true;
    dialog.setAttribute("aria-busy", "true");
    try {
      await fn();
      render();
    } catch (error) {
      render(error.message || "服务暂时不可用");
    } finally {
      busy = false;
      dialog.removeAttribute("aria-busy");
    }
  }
  button.onclick = () => {
    render();
    dialog.showModal();
    if (!state.planId) return;
    perform(async () => {
      try {
        plan = await api("plans/" + state.planId);
      } catch (e) {
        if (e.status !== 404) throw e;
        delete state.planId;
        delete state.testId;
        save();
        return;
      }
      if (state.testId) {
        test = await api("pretests/" + state.testId);
        try {
          profile = await api("pretests/" + state.testId + "/paper-profile");
        } catch (e) {
          if (e.status !== 409) throw e;
        }
      }
    });
  };
  async function grade(payload) {
    profile = (
      await api("pretests/" + test.test_id + "/grade", "POST", payload)
    ).paper_profile;
  }
  dialog.onclick = (e) => {
    const action = e.target.closest("[data-do]")?.dataset.do;
    if (action === "close") {
      dialog.close();
      return;
    }
    if (!action) return;
    perform(async () => {
      if (action === "create") {
        plan = await api("plans", "POST", {
          paperId: paper.id,
          contentVersion: "v1",
          input: { profile: await profileInput() },
        });
        state.planId = plan.planId;
        delete state.testId;
        delete state.choices;
        test = profile = null;
        save();
      } else if (action === "edit") {
        plan = await api("plans/" + plan.planId, "PATCH", {
          revision: plan.revision,
          changes: { depth: dialog.querySelector("select").value },
        });
        delete state.testId;
        delete state.choices;
        test = profile = null;
        save();
      } else if (action === "test" || action === "sample") {
        const mode = action === "sample" ? "sample" : "model";
        dialog.querySelector("[role=status]").textContent = "正在准备题目…";
        test = await api("pretests", "POST", {
          planId: plan.planId,
          revision: plan.revision,
          mode,
        });
        state.testId = test.test_id;
        delete state.choices;
        profile = test.paper_profile || null;
        save();
      } else if (action === "skip") {
        await grade({ skip: true });
      }
    });
  };
  dialog.onchange = (e) => {
    if (e.target.closest("#study-answers")) {
      state.choices = Object.fromEntries(new FormData(e.target.form));
      save();
    }
  };
  dialog.onsubmit = (e) => {
    e.preventDefault();
    const answers = Object.fromEntries(new FormData(e.target));
    perform(() => grade({ answers }));
  };
  return {
    get testId() {
      return state.testId;
    },
  };
}
