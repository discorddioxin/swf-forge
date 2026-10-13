package game_fla
{
   import com.gaiaonline.games.gPinball.PinballCore;
   import flash.display.MovieClip;
   import flash.text.TextField;
   
   [Embed(source="/_assets/assets.swf", symbol="symbol336")]
   public dynamic class grunny_bonus_text_420 extends MovieClip
   {
      
      public var txtMultiple:TextField;
      
      public function grunny_bonus_text_420()
      {
         super();
         addFrameScript(0,frame1);
      }
      
      internal function frame1() : *
      {
         trace("Field Multiplier should be " + PinballCore.__Table.fmLight.currentFrame);
         txtMultiple.text = "x" + PinballCore.__Table.fmLight.currentFrame;
      }
   }
}

