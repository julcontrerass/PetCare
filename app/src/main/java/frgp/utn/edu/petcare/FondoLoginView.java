package frgp.utn.edu.petcare;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.drawable.Drawable;
import android.util.AttributeSet;
import android.view.View;

import androidx.annotation.Nullable;
import androidx.core.content.ContextCompat;

/**
 * Dibuja el fondo del login ajustado al ancho de la pantalla: la parte superior (manchas y huellas)
 * queda arriba y la inferior (mascotas) abajo. El tramo central de la imagen es liso, así que se
 * rellena con el color crema y el fondo no se agranda en pantallas altas.
 */
public class FondoLoginView extends View {

    private static final float FRACCION_SUPERIOR = 0.35f;
    private static final float DESPLAZAMIENTO_INFERIOR_DP = 70f;

    private final Drawable fondo;

    public FondoLoginView(Context context, @Nullable AttributeSet attrs) {
        super(context, attrs);
        fondo = ContextCompat.getDrawable(context, R.drawable.fondo_login);
    }

    @Override
    protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);
        if (fondo == null) return;
        int w = getWidth();
        int h = getHeight();
        int iw = fondo.getIntrinsicWidth();
        int ih = fondo.getIntrinsicHeight();
        if (w <= 0 || h <= 0 || iw <= 0 || ih <= 0) return;

        canvas.drawColor(ContextCompat.getColor(getContext(), R.color.login_bg));

        int alto = Math.round(ih * (w / (float) iw));
        int corteSuperior = Math.round(alto * FRACCION_SUPERIOR);
        int desplazamiento = Math.round(DESPLAZAMIENTO_INFERIOR_DP * getResources().getDisplayMetrics().density);

        canvas.save();
        canvas.clipRect(0, 0, w, corteSuperior);
        fondo.setBounds(0, 0, w, alto);
        fondo.draw(canvas);
        canvas.restore();

        int topInferior = h + desplazamiento - alto;
        canvas.save();
        canvas.clipRect(0, topInferior + corteSuperior, w, h);
        fondo.setBounds(0, topInferior, w, topInferior + alto);
        fondo.draw(canvas);
        canvas.restore();
    }
}
