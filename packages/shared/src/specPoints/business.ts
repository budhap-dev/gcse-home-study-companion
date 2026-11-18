/**
 * Every numbered point of Pearson Edexcel GCSE Business 1BS0, for the specification checklist:
 * the Subject content column, under each topic's heading. Extracted from the specification
 * PDF (Issue 2, July 2022) on 18 November 2026.
 */
import type { SpecSection } from './types.ts'

export const BUSINESS_POINTS: SpecSection[] = [
  { id: '1.1', name: "1.1 Enterprise and entrepreneurship", points: [
    { code: '1.1.1', text: "The dynamic nature of business" },
    { code: '1.1.2', text: "Risk and reward" },
    { code: '1.1.3', text: "The role of business enterprise" },
  ] },
  { id: '1.2', name: "1.2 Spotting a business opportunity", points: [
    { code: '1.2.1', text: "Customer needs" },
    { code: '1.2.2', text: "Market research" },
    { code: '1.2.3', text: "Market segmentation" },
    { code: '1.2.4', text: "The competitive environment" },
  ] },
  { id: '1.3', name: "1.3 Putting a business idea into practice", points: [
    { code: '1.3.1', text: "Business aims and objectives" },
    { code: '1.3.2', text: "Business revenues, costs and profits" },
    { code: '1.3.3', text: "Cash and cash-flow" },
    { code: '1.3.4', text: "Sources of business finance" },
  ] },
  { id: '1.4', name: "1.4 Making the business effective", points: [
    { code: '1.4.1', text: "The options for start-up and small businesses" },
    { code: '1.4.2', text: "Business location" },
    { code: '1.4.3', text: "The marketing mix" },
    { code: '1.4.4', text: "Business plans" },
  ] },
  { id: '1.5', name: "1.5 Understanding external influences on business", points: [
    { code: '1.5.1', text: "Business stakeholders" },
    { code: '1.5.2', text: "Technology and business" },
    { code: '1.5.3', text: "Legislation and business" },
    { code: '1.5.4', text: "The economy and business" },
    { code: '1.5.5', text: "External influences" },
  ] },
  { id: '2.1', name: "2.1 Growing the business", points: [
    { code: '2.1.1', text: "Business growth" },
    { code: '2.1.2', text: "Changes in business aims and objectives" },
    { code: '2.1.3', text: "Business and globalisation" },
    { code: '2.1.4', text: "Ethics, the environment and business" },
  ] },
  { id: '2.2', name: "2.2 Making marketing decisions", points: [
    { code: '2.2.1', text: "Product" },
    { code: '2.2.2', text: "Price" },
    { code: '2.2.3', text: "Promotion" },
    { code: '2.2.4', text: "Place" },
    { code: '2.2.5', text: "Using the marketing mix to make business decisions" },
  ] },
  { id: '2.3', name: "2.3 Making operational decisions", points: [
    { code: '2.3.1', text: "Business operations" },
    { code: '2.3.2', text: "Working with suppliers" },
    { code: '2.3.3', text: "Managing quality" },
    { code: '2.3.4', text: "The sales process" },
  ] },
  { id: '2.4', name: "2.4 Making financial decisions", points: [
    { code: '2.4.1', text: "Business calculations" },
    { code: '2.4.2', text: "Understanding business performance" },
  ] },
  { id: '2.5', name: "2.5 Making human resource decisions", points: [
    { code: '2.5.1', text: "Organisational structures" },
    { code: '2.5.2', text: "Effective recruitment" },
    { code: '2.5.3', text: "Effective training and development" },
    { code: '2.5.4', text: "Motivation" },
  ] },
]
