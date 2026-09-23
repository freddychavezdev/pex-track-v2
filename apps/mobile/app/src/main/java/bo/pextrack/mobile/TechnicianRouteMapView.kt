package bo.pextrack.mobile

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.Typeface
import android.view.MotionEvent
import android.view.ScaleGestureDetector
import android.view.View
import kotlin.math.max

class TechnicianRouteMapView(
  context: Context,
  private val distanceKm: Double
) : View(context) {
  private var zoom = 1f
  private var panX = 0f
  private var panY = 0f
  private var lastTouchX = 0f
  private var lastTouchY = 0f
  private val scaleDetector = ScaleGestureDetector(context, object : ScaleGestureDetector.SimpleOnScaleGestureListener() {
    override fun onScale(detector: ScaleGestureDetector): Boolean {
      zoom = (zoom * detector.scaleFactor).coerceIn(1f, 3f)
      invalidate()
      return true
    }
  })
  private val gridPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.rgb(213, 229, 232); strokeWidth = dp(1f) }
  private val roadPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.rgb(178, 207, 211); strokeWidth = dp(3f); style = Paint.Style.STROKE }
  private val routePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.rgb(45, 116, 223); strokeWidth = dp(4f); style = Paint.Style.STROKE }
  private val labelPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { textSize = dp(12f); typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD); color = Color.rgb(24, 34, 48) }
  private val technicianPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.rgb(22, 133, 93) }
  private val orderPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.rgb(198, 60, 60) }

  override fun onDraw(canvas: Canvas) {
    super.onDraw(canvas)
    canvas.drawColor(Color.rgb(239, 248, 248))
    canvas.save()
    canvas.translate(panX, panY)
    canvas.scale(zoom, zoom, width / 2f, height / 2f)
    val left = paddingLeft.toFloat()
    val top = paddingTop.toFloat()
    val right = width - paddingRight.toFloat()
    val bottom = height - paddingBottom.toFloat()
    val centerX = (left + right) / 2f
    val centerY = (top + bottom) / 2f
    val technician = floatArrayOf(centerX - dp(74f), centerY + dp(24f))
    val order = floatArrayOf(centerX + dp(78f), centerY - dp(24f))

    var x = left
    while (x <= right) {
      canvas.drawLine(x, top, x, bottom, gridPaint)
      x += dp(28f)
    }
    var y = top
    while (y <= bottom) {
      canvas.drawLine(left, y, right, y, gridPaint)
      y += dp(28f)
    }

    val diagonal = Path().apply {
      moveTo(left, centerY + dp(65f))
      lineTo(centerX - dp(40f), top)
      lineTo(centerX + dp(20f), bottom)
      lineTo(right, centerY - dp(58f))
    }
    canvas.drawPath(diagonal, roadPaint)
    canvas.drawLine(left, centerY - dp(50f), right, centerY + dp(54f), roadPaint)
    canvas.drawLine(centerX - dp(110f), bottom, centerX + dp(90f), top, roadPaint)
    canvas.drawLine(technician[0], technician[1], order[0], order[1], routePaint)

    drawMarker(canvas, technician[0], technician[1], technicianPaint, "T")
    drawMarker(canvas, order[0], order[1], orderPaint, "OT")
    drawLabel(canvas, "Tu posición", technician[0] - dp(34f), technician[1] + dp(34f))
    drawLabel(canvas, "OT", order[0] - dp(14f), order[1] - dp(20f))
    labelPaint.textSize = dp(11f)
    labelPaint.color = Color.rgb(65, 89, 101)
    canvas.drawText("Distancia aprox. ${"%.2f".format(distanceKm)} km", left + dp(12f), bottom - dp(12f), labelPaint)
    canvas.restore()
  }

  override fun onTouchEvent(event: MotionEvent): Boolean {
    scaleDetector.onTouchEvent(event)
    when (event.actionMasked) {
      MotionEvent.ACTION_DOWN -> {
        lastTouchX = event.x
        lastTouchY = event.y
      }
      MotionEvent.ACTION_MOVE -> if (event.pointerCount == 1 && !scaleDetector.isInProgress) {
        panX += event.x - lastTouchX
        panY += event.y - lastTouchY
        clampPan()
        lastTouchX = event.x
        lastTouchY = event.y
        invalidate()
      }
      MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> performClick()
    }
    return true
  }

  override fun performClick(): Boolean {
    super.performClick()
    return true
  }

  fun zoomIn() {
    zoom = (zoom + .25f).coerceAtMost(3f)
    clampPan()
    invalidate()
  }

  fun zoomOut() {
    zoom = (zoom - .25f).coerceAtLeast(1f)
    clampPan()
    invalidate()
  }

  private fun clampPan() {
    val maxPanX = width * (zoom - 1f) / 2f
    val maxPanY = height * (zoom - 1f) / 2f
    panX = panX.coerceIn(-maxPanX, maxPanX)
    panY = panY.coerceIn(-maxPanY, maxPanY)
  }

  private fun drawMarker(canvas: Canvas, x: Float, y: Float, color: Paint, label: String) {
    canvas.drawCircle(x, y, dp(17f), Paint(Paint.ANTI_ALIAS_FLAG).apply { this.color = Color.argb(45, Color.red(color.color), Color.green(color.color), Color.blue(color.color)) })
    canvas.drawCircle(x, y, dp(11f), color)
    val markerPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      this.color = Color.WHITE
      textSize = dp(if (label == "OT") 9f else 11f)
      typeface = Typeface.DEFAULT_BOLD
      textAlign = Paint.Align.CENTER
    }
    canvas.drawText(label, x, y + dp(4f), markerPaint)
  }

  private fun drawLabel(canvas: Canvas, text: String, x: Float, y: Float) {
    labelPaint.textSize = dp(12f)
    labelPaint.color = Color.rgb(24, 34, 48)
    canvas.drawText(text, max(paddingLeft.toFloat(), x), y, labelPaint)
  }

  private fun dp(value: Float): Float = value * resources.displayMetrics.density
}
