// The PDF waiting to be saved or shared. Kept apart from the PDF engine so the
// app can watch for it without loading jsPDF (and the 3D renderer) at start-up.
import type { jsPDF } from 'jspdf';
import { create } from 'zustand';

export const usePdfExport = create<{ doc: jsPDF | null; filename: string; result: string | null }>(() => ({ doc: null, filename: '', result: null }));
