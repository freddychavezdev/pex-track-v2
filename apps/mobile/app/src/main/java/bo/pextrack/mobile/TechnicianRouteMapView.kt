package bo.pextrack.mobile

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.Typeface
import android.location.Location
import android.view.MotionEvent
import android.view.ScaleGestureDetector
import android.view.View
import bo.pextrack.mobile.operations.MobileWorkOrder
import kotlin.math.max

class TechnicianRouteMapView(
  context: Context,
  private val technicianLocation: Location?,
  private val orders: List<MobileWorkOrder>,
  private val selectedOrderId: String?
) : View(context) {
  private var zoom = 1f
  private var panX = 0f
  private var panY = 0f
  private var lastTouchX = 0f
  private var lastTouchY = 0f
  private val scaleDetector = ScaleGestureDetector(context, object : ScaleGestureDetector.SimpleOnScaleGestureListener() {
    override fun onScale(detector: ScaleGestureDetector): Boolean {
      zoom = (zoom * detector.scaleFactor).coerceIn(1f, 4f)
      clampPan()
      invalidate()
      return true
    }
  })
  private val gridPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.rgb(213, 229, 232); strokeWidth = dp(1f) }
  private val roadPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.rgb(178, 207, 211); strokeWidth = dp(3f); style = Paint.Style.STROKE }
  private val routePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.rgb(37, 99, 235); strokeWidth = dp(4f); style = Paint.Style.STROKE }
  private val labelPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { textSize = dp(12f); typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD); color = Color.rgb(24, 34, 48) }

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
    drawBackground(canvas, left, top, right, bottom, centerX, centerY)

    val locatedOrders = orders.filter { it.latitude != null && it.longitude != null }
      .sortedWith(compareBy({ it.route_sequence ?: Int.MAX_VALUE }, { it.code }))
    if (locatedOrders.isEmpty()) {
      drawMessage(canvas, "No hay coordenadas de OTs asignadas", centerX, centerY)
      canvas.restore()
      return
    }

    val allLocations = locatedOrders.map { it.latitude!! to it.longitude!! }.toMutableList()
    technicianLocation?.let { allLocations += it.latitude to it.longitude }
    val minLat = allLocations.minOf { it.first }
    val maxLat = allLocations.maxOf { it.first }
    val minLon = allLocations.minOf { it.second }
    val maxLon = allLocations.maxOf { it.second }
    val latSpan = max(maxLat - minLat, 0.0008)
    val lonSpan = max(maxLon - minLon, 0.0008)

    fun project(latitude: Double, longitude: Double): Pair<Float, Float> {
      val mapWidth = right - left - dp(44f)
      val mapHeight = bottom - top - dp(44f)
      val x = left + dp(22f) + (((longitude - minLon) / lonSpan) * mapWidth).toFloat()
      val y = top + dp(22f) + (((maxLat - latitude) / latSpan) * mapHeight).toFloat()
      return x to y
    }

    val orderPoints = locatedOrders.map { it to project(it.latitude!!, it.longitude!!) }
    val technicianPoint = technicianLocation?.let { project(it.latitude, it.longitude) }
    drawRoute(canvas, orderPoints, technicianPoint)
    orderPoints.forEachIndexed { index, (order, point) ->
      val selected = order.id == selectedOrderId
      val color = orderColor(order.status)
      if (selected) drawSelectionRing(canvas, point.first, point.second, color)
      drawMarker(canvas, point.first, point.second, color, order.route_sequence?.toString() ?: "OT", selected)
      drawLabel(canvas, order.code, point.first - dp(24f), point.second - dp(20f))
      if (order.route_sequence == null) drawLabel(canvas, "OT #${index + 1}", point.first - dp(21f), point.second + dp(30f))
    }
    technicianPoint?.let { point ->
      drawMarker(canvas, point.first, point.second, Color.rgb(22, 133, 93), "T", false)
      drawLabel(canvas, "Tu posición", point.first - dp(33f), point.second + dp(32f))
    }
    labelPaint.textSize = dp(10f)
    labelPaint.color = Color.rgb(65, 89, 101)
    canvas.drawText("${locatedOrders.size} OT(s) ubicadas · verde atendida · rojo suspendida · naranja pendiente", left + dp(10f), bottom - dp(10f), labelPaint)
    canvas.restore()
  }

  private fun drawBackground(canvas: Canvas, left: Float, top: Float, right: Float, bottom: Float, centerX: Float, centerY: Float) {
    var x = left
    while (x <= right) { canvas.drawLine(x, top, x, bottom, gridPaint); x += dp(28f) }
    var y = top
    while (y <= bottom) { canvas.drawLine(left, y, right, y, gridPaint); y += dp(28f) }
    val diagonal = Path().apply {
      moveTo(left, centerY + dp(65f)); lineTo(centerX - dp(40f), top)
      lineTo(centerX + dp(20f), bottom); lineTo(right, centerY - dp(58f))
    }
    canvas.drawPath(diagonal, roadPaint)
    canvas.drawLine(left, centerY - dp(50f), right, centerY + dp(54f), roadPaint)
    canvas.drawLine(centerX - dp(110f), bottom, centerX + dp(90f), top, roadPaint)
  }

  private fun drawRoute(canvas: Canvas, orderPoints: List<Pair<MobileWorkOrder, Pair<Float, Float>>>, technicianPoint: Pair<Float, Float>?) {
    val routePoints = buildList {
      technicianPoint?.let { add(it) }
      addAll(orderPoints.map { it.second })
    }
    routePoints.zipWithNext().forEach { (from, to) -> canvas.drawLine(from.first, from.second, to.first, to.second, routePaint) }
  }

  private fun drawMessage(canvas: Canvas, message: String, x: Float, y: Float) {
    labelPaint.textSize = dp(13f); labelPaint.color = Color.rgb(65, 89, 101)
    labelPaint.textAlign = Paint.Align.CENTER; canvas.drawText(message, x, y, labelPaint); labelPaint.textAlign = Paint.Align.LEFT
  }

  override fun onTouchEvent(event: MotionEvent): Boolean {
    scaleDetector.onTouchEvent(event)
    when (event.actionMasked) {
      MotionEvent.ACTION_DOWN -> { lastTouchX = event.x; lastTouchY = event.y }
      MotionEvent.ACTION_MOVE -> if (event.pointerCount == 1 && !scaleDetector.isInProgress) {
        panX += event.x - lastTouchX; panY += event.y - lastTouchY; clampPan()
        lastTouchX = event.x; lastTouchY = event.y; invalidate()
      }
      MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> performClick()
    }
    return true
  }

  override fun performClick(): Boolean { super.performClick(); return true }
  fun zoomIn() { zoom = (zoom + .25f).coerceAtMost(4f); clampPan(); invalidate() }
  fun zoomOut() { zoom = (zoom - .25f).coerceAtLeast(1f); clampPan(); invalidate() }

  private fun clampPan() {
    val maxPanX = width * (zoom - 1f) / 2f; val maxPanY = height * (zoom - 1f) / 2f
    panX = panX.coerceIn(-maxPanX, maxPanX); panY = panY.coerceIn(-maxPanY, maxPanY)
  }

  private fun orderColor(status: String): Int = when (status) {
    "completed" -> Color.rgb(22, 163, 74)
    "suspended" -> Color.rgb(220, 38, 38)
    "in_progress" -> Color.rgb(37, 99, 235)
    else -> Color.rgb(234, 116, 20)
  }

  private fun drawSelectionRing(canvas: Canvas, x: Float, y: Float, color: Int) {
    canvas.drawCircle(x, y, dp(22f), Paint(Paint.ANTI_ALIAS_FLAG).apply { this.color = color; style = Paint.Style.STROKE; strokeWidth = dp(3f) })
  }

  private fun drawMarker(canvas: Canvas, x: Float, y: Float, color: Int, label: String, selected: Boolean) {
    val radius = if (selected) dp(14f) else dp(11f)
    canvas.drawCircle(x, y, radius + dp(7f), Paint(Paint.ANTI_ALIAS_FLAG).apply { this.color = Color.argb(48, Color.red(color), Color.green(color), Color.blue(color)) })
    canvas.drawCircle(x, y, radius, Paint(Paint.ANTI_ALIAS_FLAG).apply { this.color = color })
    val markerPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { this.color = Color.WHITE; textSize = dp(if (label.length > 2) 8f else 10f); typeface = Typeface.DEFAULT_BOLD; textAlign = Paint.Align.CENTER }
    canvas.drawText(label, x, y + dp(4f), markerPaint)
  }

  private fun drawLabel(canvas: Canvas, text: String, x: Float, y: Float) {
    labelPaint.textSize = dp(10f); labelPaint.color = Color.rgb(24, 34, 48); canvas.drawText(text, max(paddingLeft.toFloat(), x), y, labelPaint)
  }

  private fun dp(value: Float): Float = value * resources.displayMetrics.density
}
