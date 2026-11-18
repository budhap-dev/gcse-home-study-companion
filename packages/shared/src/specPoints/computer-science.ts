/**
 * Every numbered point of AQA GCSE Computer Science 8525, for the specification checklist:
 * the board's sub-section headings, the level at which its content is numbered. 3.5 and 3.8
 * have no sub-sections, so each is one point. Extracted from the specification PDF (version
 * 1.2, 29 November 2022) on 18 November 2026.
 */
import type { SpecSection } from './types.ts'

export const COMPUTER_SCIENCE_POINTS: SpecSection[] = [
  { id: '3.1', name: "3.1 Fundamentals of algorithms", points: [
    { code: '3.1.1', text: "Representing algorithms" },
    { code: '3.1.2', text: "Efficiency of algorithms" },
    { code: '3.1.3', text: "Searching algorithms" },
    { code: '3.1.4', text: "Sorting algorithms" },
  ] },
  { id: '3.2', name: "3.2 Programming", points: [
    { code: '3.2.1', text: "Data types" },
    { code: '3.2.2', text: "Programming concepts" },
    { code: '3.2.3', text: "Arithmetic operations in a programming language" },
    { code: '3.2.4', text: "Relational operations in a programming language" },
    { code: '3.2.5', text: "Boolean operations in a programming language" },
    { code: '3.2.6', text: "Data structures" },
    { code: '3.2.7', text: "Input/output" },
    { code: '3.2.8', text: "String handling operations in a programming language" },
    { code: '3.2.9', text: "Random number generation in a programming language" },
    { code: '3.2.10', text: "Structured programming and subroutines (procedures and functions)" },
    { code: '3.2.11', text: "Robust and secure programming" },
  ] },
  { id: '3.3', name: "3.3 Fundamentals of data representation", points: [
    { code: '3.3.1', text: "Number bases" },
    { code: '3.3.2', text: "Converting between number bases" },
    { code: '3.3.3', text: "Units of information" },
    { code: '3.3.4', text: "Binary arithmetic" },
    { code: '3.3.5', text: "Character encoding" },
    { code: '3.3.6', text: "Representing images" },
    { code: '3.3.7', text: "Representing sound" },
    { code: '3.3.8', text: "Data compression" },
  ] },
  { id: '3.4', name: "3.4 Computer systems", points: [
    { code: '3.4.1', text: "Hardware and software" },
    { code: '3.4.2', text: "Boolean logic" },
    { code: '3.4.3', text: "Software classification" },
    { code: '3.4.4', text: "Classification of programming languages and translators" },
    { code: '3.4.5', text: "Systems architecture" },
  ] },
  { id: '3.5', name: "3.5 Fundamentals of computer networks", points: [
    { code: '3.5', text: "Fundamentals of computer networks" },
  ] },
  { id: '3.6', name: "3.6 Cyber security", points: [
    { code: '3.6.1', text: "Fundamentals of cyber security" },
    { code: '3.6.2', text: "Cyber security threats" },
    { code: '3.6.2.1', text: "Social engineering" },
    { code: '3.6.2.2', text: "Malicious code (malware)" },
    { code: '3.6.3', text: "Methods to detect and prevent cyber security threats" },
  ] },
  { id: '3.7', name: "3.7 Relational databases and structured query language (SQL)", points: [
    { code: '3.7.1', text: "Relational databases" },
    { code: '3.7.2', text: "Structured query language (SQL)" },
  ] },
  { id: '3.8', name: "3.8 Ethical, legal and environmental impacts of digital technology on wider society, including issues of privacy", points: [
    { code: '3.8', text: "Ethical, legal and environmental impacts of digital technology on wider society, including issues of privacy" },
  ] },
]
