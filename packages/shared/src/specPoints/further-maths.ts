/**
 * Every content point of AQA Level 2 Certificate in Further Mathematics 8365, for the
 * specification checklist: the left-hand Content column, in the board's words. Extracted from
 * the specification PDF (version 1.4) on 18 November 2026; maths the PDF text lost, and
 * the sub-headings that ran into a row, written back as printed. 1.1 has its words in the
 * Notes column only, so they are used.
 */
import type { SpecSection } from './types.ts'

export const FURTHER_MATHS_POINTS: SpecSection[] = [
  { id: '1', name: "Number", points: [
    { code: '1.1', text: "Knowledge and use of numbers and the number system including fractions, decimals, percentages, ratio, proportion and order of operations are expected" },
    { code: '1.2', text: "The product rule for counting" },
    { code: '1.3', text: "Manipulation of surds, including rationalising the denominator" },
  ] },
  { id: '2', name: "Algebra", points: [
    { code: '2.1', text: "The basic processes of algebra" },
    { code: '2.2', text: "Definition of a function" },
    { code: '2.3', text: "Domain and range of a function" },
    { code: '2.4', text: "Composite functions" },
    { code: '2.5', text: "Inverse functions" },
    { code: '2.6', text: "Expanding brackets and collecting like terms" },
    { code: '2.7', text: "Expand (a + b)ⁿ for positive integer n" },
    { code: '2.8', text: "Factorising" },
    { code: '2.9', text: "Manipulation of rational expressions: Use of + – × ÷ for algebraic fractions with denominators being numeric, linear or quadratic" },
    { code: '2.10', text: "Use and manipulation of formulae and expressions" },
    { code: '2.11', text: "Use of the factor theorem for rational values of the variable for polynomials" },
    { code: '2.12', text: "Completing the square" },
    { code: '2.13', text: "Drawing and sketching of functions; interpretation of graphs" },
    { code: '2.14', text: "Solution of linear and quadratic equations" },
    { code: '2.15', text: "Algebraic and graphical solution of simultaneous equations in two unknowns, where the equations could both be linear or one linear and one second order" },
    { code: '2.16', text: "Algebraic solution of linear equations in three unknowns" },
    { code: '2.17', text: "Solution of linear and quadratic inequalities" },
    { code: '2.18', text: "Index laws, including fractional and negative indices and the solution of equations" },
    { code: '2.19', text: "Algebraic proof" },
    { code: '2.20', text: "Using nth terms of sequences; limiting value of a sequence as n → ∞" },
    { code: '2.21', text: "nth terms of linear sequences" },
    { code: '2.22', text: "nth terms of quadratic sequences" },
  ] },
  { id: '3', name: "Coordinate geometry (2 dimensions only)", points: [
    { code: '3.1', text: "Know and use the definition of a gradient" },
    { code: '3.2', text: "Know the relationship between the gradients of parallel and perpendicular lines" },
    { code: '3.3', text: "Use Pythagoras’ theorem to calculate the distance between two points" },
    { code: '3.4', text: "Use ratio to find the coordinates of a point on a line given the coordinates of two other points" },
    { code: '3.5', text: "The equation of a straight line y = mx + c and y – y₁ = m(x – x₁) and other forms" },
    { code: '3.6', text: "Draw a straight line from given information" },
    { code: '3.7', text: "Understand that x² + y² = r² is the equation of a circle with centre (0, 0) and radius r" },
    { code: '3.8', text: "Understand that (x – a)² + (y – b)² = r² is the equation of a circle with centre (a, b) and radius r" },
    { code: '3.9', text: "The equation of a tangent at a point on a circle" },
  ] },
  { id: '4', name: "Calculus", points: [
    { code: '4.1', text: "Know that the gradient function dy/dx gives the gradient of the curve and measures the rate of change of y with respect to x" },
    { code: '4.2', text: "Know that the gradient of a function is the gradient of the tangent at that point" },
    { code: '4.3', text: "Differentiation of kxⁿ where n is an integer, and the sum of such functions" },
    { code: '4.4', text: "The equation of a tangent and normal at any point on a curve" },
    { code: '4.5', text: "Increasing and decreasing functions" },
    { code: '4.6', text: "Understand and use the notation d²y/dx²" },
    { code: '4.7', text: "Use of differentiation to find maxima and minima points on a curve" },
    { code: '4.8', text: "Using calculus to find maxima and minima in simple problems" },
    { code: '4.9', text: "Sketch/interpret a curve with known maximum and minimum points" },
  ] },
  { id: '5', name: "Matrix transformations", points: [
    { code: '5.1', text: "Multiplication of matrices" },
    { code: '5.2', text: "The identity matrix I" },
    { code: '5.3', text: "Transformations of the unit square in the x – y plane" },
    { code: '5.4', text: "Combination of transformations" },
  ] },
  { id: '6', name: "Geometry", points: [
    { code: '6.1', text: "Geometric proof" },
    { code: '6.2', text: "Understand and construct geometrical proofs using formal arguments" },
    { code: '6.3', text: "Sine and cosine rules in scalene triangles; area of a triangle = ½ab sin C" },
    { code: '6.4', text: "Use of Pythagoras’ theorem in 2D and 3D" },
    { code: '6.5', text: "Be able to apply trigonometry and Pythagoras’ theorem to 2 and 3 dimensional problems" },
    { code: '6.6', text: "Sketch and use graphs of y = sin x, y = cos x and y = tan x for angles of any size" },
    { code: '6.7', text: "Be able to use the definitions sin θ, cos θ and tan θ, for any positive angle up to 360° (measured in degrees only)" },
    { code: '6.8', text: "Knowledge and use of 30°, 60°, 90° triangles and 45°, 45°, 90° triangles" },
    { code: '6.9', text: "Know and use tan θ = sin θ / cos θ and sin² θ + cos² θ = 1" },
    { code: '6.10', text: "Solution of simple trigonometric equations in given intervals" },
  ] },
]
