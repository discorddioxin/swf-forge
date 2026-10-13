package
{
   import com.gaiaonline.games.gPinball.compound_elements.Flipper;
   
   [Embed(source="/_assets/assets.swf", symbol="symbol603")]
   public dynamic class Flipper_Fishing extends Flipper
   {
      
      public function Flipper_Fishing()
      {
         super();
         addFrameScript(0,frame1);
      }
      
      internal function frame1() : *
      {
         stop();
      }
   }
}

