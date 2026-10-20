import { NextResponse } from "next/server";
import { SHEET_ID, TABS } from "../../../config";
import { fetchTab } from "../../../lib/csv";
import { compute } from "../../../lib/engine";

export const revalidate = 300; // serve cached result up to 5 minutes

export async function GET() {
  try {
    const [products, sales, inventory, pipeline, plan, seasonality, settings] = await Promise.all([
      fetchTab(SHEET_ID, TABS.products),
      fetchTab(SHEET_ID, TABS.sales),
      fetchTab(SHEET_ID, TABS.inventory),
      fetchTab(SHEET_ID, TABS.pipeline),
      fetchTab(SHEET_ID, TABS.plan),
      fetchTab(SHEET_ID, TABS.seasonality).catch(() => []),
      fetchTab(SHEET_ID, TABS.settings),
    ]);
    const result = compute({ products, sales, inventory, pipeline, plan, seasonality, settings });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
